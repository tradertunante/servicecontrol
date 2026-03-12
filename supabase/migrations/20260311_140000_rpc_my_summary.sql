-- rpc_my_summary
-- Purpose:
-- low-risk server-side replacement for the current client-side /my dashboard pipeline.
--
-- Validation notes / TODO before production use:
-- 1. Timezone handling:
--    Current frontend computes daily/weekly/monthly ranges in browser local time.
--    This function uses the database session timezone via now().
--    Validate whether that matches desired hotel/business behavior.
--
-- 2. Duplicate assignments:
--    If area_template_target_assignments contains duplicate logical rows for the same
--    (hotel_id, user_id, audit_template_id, period, area_id), totals may be inflated.
--    Validate data quality before relying on this as source of truth.
--
-- 3. Summary quirk compatibility:
--    Current useMyDashboardData derives total_audits_done and average_score from the
--    limited recent_runs set (top 10), not from all runs in the period.
--    This function preserves that behavior intentionally in v1.
--
-- 4. Hotel/context validation assumptions:
--    Current frontend uses localStorage['sc_hotel_id'] as hotel context for /my.
--    This function assumes p_hotel_id is already the intended hotel context and does not
--    attempt to infer/override it beyond validating the user profile exists and is active.

create or replace function public.rpc_my_summary(
  p_hotel_id uuid,
  p_user_id uuid,
  p_period text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_result jsonb;
begin
  -- Period translation aligned with current frontend semantics as closely as possible.
  -- NOTE: weekly starts on Monday.
  if p_period = 'daily' then
    v_start_ts := date_trunc('day', v_now);
    v_end_ts := v_start_ts + interval '1 day' - interval '1 millisecond';
  elsif p_period = 'weekly' then
    v_start_ts := date_trunc('day', v_now) - ((extract(isodow from v_now)::int - 1) * interval '1 day');
    v_end_ts := v_start_ts + interval '7 day' - interval '1 millisecond';
  elsif p_period = 'monthly' then
    v_start_ts := date_trunc('month', v_now);
    v_end_ts := v_start_ts + interval '1 month' - interval '1 millisecond';
  else
    raise exception 'Invalid p_period: %. Expected daily, weekly or monthly.', p_period;
  end if;

  with
  -- 1) Caller profile validation
  caller_profile as (
    select
      p.id,
      p.full_name,
      p.role,
      p.hotel_id,
      p.email,
      p.active
    from public.profiles p
    where p.id = p_user_id
    limit 1
  ),

  validated_caller as (
    select *
    from caller_profile cp
    where cp.active is distinct from false
  ),

  -- 2) Hotel label for current context
  hotel_row as (
    select
      h.id,
      h.name
    from public.hotels h
    where h.id = p_hotel_id
    limit 1
  ),

  -- 3) Area scope from user_area_access
  scoped_areas as (
    select distinct uaa.area_id
    from public.user_area_access uaa
    join validated_caller vc on true
    where uaa.hotel_id = p_hotel_id
      and uaa.user_id = p_user_id
      and uaa.area_id is not null
  ),

  area_catalog as (
    select
      a.id,
      coalesce(a.name, 'Área') as name,
      a.sort_order
    from public.areas a
    where a.id in (select sa.area_id from scoped_areas sa)
  ),

  area_names_rows as (
    select
      ac.name,
      ac.sort_order
    from area_catalog ac
    order by ac.sort_order asc nulls last, ac.name asc
  ),

  -- 4) Active assignments for the current user and period
  assignments as (
    select
      atta.id,
      atta.area_id,
      atta.audit_template_id,
      atta.user_id,
      atta.period,
      coalesce(atta.target_count, 0)::int as target_count,
      atta.active
    from public.area_template_target_assignments atta
    where atta.hotel_id = p_hotel_id
      and atta.user_id = p_user_id
      and atta.period = p_period
      and atta.active = true
  ),

  template_catalog as (
    select
      t.id,
      coalesce(nullif(trim(t.name), ''), 'Auditoría') as name
    from public.audit_templates t
    where t.id in (
      select distinct a.audit_template_id
      from assignments a
      where a.audit_template_id is not null
    )
  ),

  -- 5) Runs for the current user in the selected period
  -- Important: v1 intentionally DOES NOT filter by status = 'submitted'
  -- to preserve current useMyDashboardData semantics as closely as possible.
  period_runs as (
    select
      r.id,
      r.executed_at,
      r.score,
      r.audit_template_id
    from public.audit_runs r
    join validated_caller vc on true
    where r.hotel_id = p_hotel_id
      and r.executed_by = p_user_id
      and r.executed_at is not null
      and r.executed_at >= v_start_ts
      and r.executed_at <= v_end_ts
  ),

  run_count_by_template as (
    select
      pr.audit_template_id,
      count(*)::int as completed_raw
    from period_runs pr
    where pr.audit_template_id is not null
    group by pr.audit_template_id
  ),

  -- 6) Group targets by template to preserve current hook behavior
  grouped_targets as (
    select
      a.audit_template_id,
      sum(a.target_count)::int as target,
      coalesce(rct.completed_raw, 0)::int as completed_raw
    from assignments a
    left join run_count_by_template rct
      on rct.audit_template_id = a.audit_template_id
    group by a.audit_template_id, rct.completed_raw
  ),

  my_targets_rows as (
    select
      gt.audit_template_id as target_id,
      p_user_id as auditor_user_id,
      vc.full_name as auditor,
      coalesce(tc.name, 'Auditoría') as template,
      gt.target,
      least(gt.completed_raw, gt.target)::int as completed,
      greatest(gt.target - least(gt.completed_raw, gt.target), 0)::int as remaining,
      case
        when gt.target > 0
          then round((least(gt.completed_raw, gt.target)::numeric / gt.target::numeric) * 100, 2)
        else 0
      end as progress_pct
    from grouped_targets gt
    join validated_caller vc on true
    left join template_catalog tc
      on tc.id = gt.audit_template_id
  ),

  -- 7) Recent runs limited to 10, preserving current hook behavior
  recent_runs_rows as (
    select
      pr.id,
      pr.executed_at,
      pr.score,
      pr.audit_template_id,
      coalesce(tc.name, 'Auditoría') as template_name
    from period_runs pr
    left join template_catalog tc
      on tc.id = pr.audit_template_id
    order by pr.executed_at desc
    limit 10
  ),

  -- 8) Summary preserving current frontend quirk:
  -- total_audits_done and average_score are derived from the limited recent_runs set.
  recent_runs_stats as (
    select
      count(*)::int as total_audits_done,
      round(avg(rr.score)::numeric, 2) as average_score
    from recent_runs_rows rr
    where true
  ),

  targets_summary as (
    select
      coalesce(sum(mtr.target), 0)::int as total_targets,
      coalesce(sum(mtr.completed), 0)::int as total_completed_targets,
      coalesce(sum(mtr.remaining), 0)::int as total_remaining,
      case
        when coalesce(sum(mtr.target), 0) > 0
          then round((coalesce(sum(mtr.completed), 0)::numeric / sum(mtr.target)::numeric) * 100, 2)
        else 0
      end as global_pct
    from my_targets_rows mtr
  )

  select jsonb_build_object(
    'hotel_name',
    (select hr.name from hotel_row hr),

    'area_names',
    coalesce(
      (
        select jsonb_agg(anr.name order by anr.sort_order asc nulls last, anr.name asc)
        from area_names_rows anr
      ),
      '[]'::jsonb
    ),

    'my_targets',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'target_id', mtr.target_id,
            'auditor_user_id', mtr.auditor_user_id,
            'auditor', mtr.auditor,
            'template', mtr.template,
            'target', mtr.target,
            'completed', mtr.completed,
            'remaining', mtr.remaining,
            'progress_pct', mtr.progress_pct
          )
          order by mtr.remaining desc, mtr.template asc
        )
        from my_targets_rows mtr
      ),
      '[]'::jsonb
    ),

    'recent_runs',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', rrr.id,
            'executed_at', rrr.executed_at,
            'score', rrr.score,
            'audit_template_id', rrr.audit_template_id,
            'template_name', rrr.template_name
          )
          order by rrr.executed_at desc
        )
        from recent_runs_rows rrr
      ),
      '[]'::jsonb
    ),

    'summary',
    jsonb_build_object(
      'total_audits_done', coalesce((select rrs.total_audits_done from recent_runs_stats rrs), 0),
      'total_targets', coalesce((select ts.total_targets from targets_summary ts), 0),
      'total_completed_targets', coalesce((select ts.total_completed_targets from targets_summary ts), 0),
      'total_remaining', coalesce((select ts.total_remaining from targets_summary ts), 0),
      'global_pct', coalesce((select ts.global_pct from targets_summary ts), 0),
      'average_score', (select rrs.average_score from recent_runs_stats rrs)
    )
  )
  into v_result
  from validated_caller;

  if v_result is null then
    raise exception 'Perfil inválido o no autorizado para rpc_my_summary.';
  end if;

  return v_result;
end;
$$;
