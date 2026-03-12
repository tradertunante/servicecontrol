-- rpc_team_summary
-- Purpose:
-- low-risk server-side replacement for the current client-side team summary pipeline.
--
-- Validation notes / TODO before production use:
-- 1. Timezone handling:
--    Current frontend computes daily/weekly/monthly ranges in browser local time.
--    This function uses the database session timezone via now().
--    Validate whether that matches desired hotel/business behavior.
--
-- 2. Duplicate assignments:
--    If area_template_target_assignments contains duplicate logical rows for the same
--    (hotel_id, area_id, audit_template_id, user_id, period), totals may be inflated.
--    Validate data quality before relying on this as source of truth.
--
-- 3. Role/access assumptions:
--    This function assumes:
--    - superadmin/admin/quality => all active areas in the hotel
--    - manager => only user_area_access scoped areas
--    - other roles => rejected
--    Validate this matches current app-level authorization expectations.

create or replace function public.rpc_team_summary(
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
  -- 1) Caller profile and access validation
  caller_profile as (
    select
      p.id,
      p.hotel_id,
      p.role,
      p.active,
      p.full_name
    from public.profiles p
    where p.id = p_user_id
    limit 1
  ),

  validated_caller as (
    select *
    from caller_profile cp
    where cp.active is distinct from false
      and cp.role in ('manager', 'quality', 'admin', 'superadmin')
      and (
        cp.role = 'superadmin'
        or cp.hotel_id = p_hotel_id
      )
  ),

  -- 2) Scoped areas by role
  scoped_areas as (
    -- admin / superadmin / quality => all active areas in hotel
    select a.id as area_id
    from public.areas a
    join validated_caller vc on true
    where vc.role in ('admin', 'superadmin', 'quality')
      and a.hotel_id = p_hotel_id
      and coalesce(a.active, true) = true

    union

    -- manager => only explicitly assigned areas
    select uaa.area_id
    from public.user_area_access uaa
    join validated_caller vc on true
    where vc.role = 'manager'
      and uaa.hotel_id = p_hotel_id
      and uaa.user_id = p_user_id
  ),

  scoped_area_ids as (
    select distinct sa.area_id
    from scoped_areas sa
    where sa.area_id is not null
  ),

  -- 3) Active assignments for requested period and scoped areas
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
      and atta.period = p_period
      and atta.active = true
      and atta.area_id in (select area_id from scoped_area_ids)
  ),

  assigned_users as (
    select distinct a.user_id
    from assignments a
    where a.user_id is not null
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

  auditor_catalog as (
    select
      p.id,
      p.full_name
    from public.profiles p
    where p.id in (select user_id from assigned_users)
  ),

  -- 4) Period runs
  -- Important: v1 intentionally DOES NOT filter by status = 'submitted'
  -- to preserve current useTeamData semantics as closely as possible.
  period_runs as (
    select
      r.id,
      r.executed_at,
      r.score,
      r.audit_template_id,
      r.executed_by
    from public.audit_runs r
    where r.hotel_id = p_hotel_id
      and r.executed_by in (select user_id from assigned_users)
      and r.executed_at is not null
      and r.executed_at >= v_start_ts
      and r.executed_at <= v_end_ts
  ),

  -- 5) Aggregations for completed counts by user/template
  run_counts_by_user_template as (
    select
      pr.executed_by as auditor_user_id,
      pr.audit_template_id,
      count(*)::int as completed_count
    from period_runs pr
    group by pr.executed_by, pr.audit_template_id
  ),

  run_counts_by_user as (
    select
      pr.executed_by as auditor_user_id,
      count(*)::int as audits_done
    from period_runs pr
    group by pr.executed_by
  ),

  score_avg_by_user as (
    select
      pr.executed_by as auditor_user_id,
      round(avg(pr.score)::numeric, 2) as avg_score
    from period_runs pr
    where pr.score is not null
    group by pr.executed_by
  ),

  -- 6) Team target rows, one row per assignment
  team_targets_rows as (
    select
      a.id as target_id,
      a.user_id as auditor_user_id,
      ac.full_name as auditor,
      coalesce(tc.name, 'Auditoría') as template,
      a.target_count as target,
      coalesce(rc.completed_count, 0) as completed,
      greatest(a.target_count - coalesce(rc.completed_count, 0), 0) as remaining,
      case
        when a.target_count > 0
          then round((coalesce(rc.completed_count, 0)::numeric / a.target_count::numeric) * 100, 2)
        else 0
      end as progress_pct
    from assignments a
    left join auditor_catalog ac
      on ac.id = a.user_id
    left join template_catalog tc
      on tc.id = a.audit_template_id
    left join run_counts_by_user_template rc
      on rc.auditor_user_id = a.user_id
     and rc.audit_template_id = a.audit_template_id
  ),

  -- 7) Leaderboard aggregated by auditor
  leaderboard_rows as (
    select
      ttr.auditor_user_id,
      coalesce(
        nullif(trim(max(ttr.auditor)), ''),
        left(ttr.auditor_user_id::text, 8)
      ) as auditor_name,
      coalesce(rcu.audits_done, 0) as audits_done,
      sau.avg_score,
      sum(ttr.target)::int as targets_total,
      sum(ttr.completed)::int as targets_completed,
      sum(ttr.remaining)::int as remaining,
      case
        when sum(ttr.target) > 0
          then round((sum(ttr.completed)::numeric / sum(ttr.target)::numeric) * 100, 2)
        else 0
      end as progress_pct
    from team_targets_rows ttr
    left join run_counts_by_user rcu
      on rcu.auditor_user_id = ttr.auditor_user_id
    left join score_avg_by_user sau
      on sau.auditor_user_id = ttr.auditor_user_id
    group by
      ttr.auditor_user_id,
      rcu.audits_done,
      sau.avg_score
  ),

  leaderboard_ordered as (
    select *
    from leaderboard_rows
    order by
      progress_pct desc,
      avg_score desc nulls last,
      auditor_name asc
  ),

  -- 8) Recent runs enriched for display, limited to 10
  recent_runs_rows as (
    select
      pr.id,
      pr.executed_at,
      pr.score,
      pr.audit_template_id,
      tc.name as template_name,
      pr.executed_by,
      ac.full_name as auditor_name
    from period_runs pr
    left join template_catalog tc
      on tc.id = pr.audit_template_id
    left join auditor_catalog ac
      on ac.id = pr.executed_by
    order by pr.executed_at desc
    limit 10
  ),

  -- 9) Summary derived from leaderboard, preserving current frontend semantics
  summary_row as (
    select
      coalesce(sum(lo.audits_done), 0)::int as total_audits_done,
      coalesce(sum(lo.targets_total), 0)::int as total_targets,
      coalesce(sum(lo.targets_completed), 0)::int as total_completed_targets,
      coalesce(sum(lo.remaining), 0)::int as total_remaining,
      case
        when coalesce(sum(lo.targets_total), 0) > 0
          then round(
            (coalesce(sum(lo.targets_completed), 0)::numeric / sum(lo.targets_total)::numeric) * 100,
            2
          )
        else 0
      end as global_pct
    from leaderboard_ordered lo
  )

  select jsonb_build_object(
    'summary',
    coalesce(
      (
        select jsonb_build_object(
          'total_audits_done', sr.total_audits_done,
          'total_targets', sr.total_targets,
          'total_completed_targets', sr.total_completed_targets,
          'total_remaining', sr.total_remaining,
          'global_pct', sr.global_pct
        )
        from summary_row sr
      ),
      jsonb_build_object(
        'total_audits_done', 0,
        'total_targets', 0,
        'total_completed_targets', 0,
        'total_remaining', 0,
        'global_pct', 0
      )
    ),

    'leaderboard',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'auditor_user_id', lo.auditor_user_id,
            'auditor_name', lo.auditor_name,
            'audits_done', lo.audits_done,
            'avg_score', lo.avg_score,
            'targets_total', lo.targets_total,
            'targets_completed', lo.targets_completed,
            'remaining', lo.remaining,
            'progress_pct', lo.progress_pct
          )
          order by lo.progress_pct desc, lo.avg_score desc nulls last, lo.auditor_name asc
        )
        from leaderboard_ordered lo
      ),
      '[]'::jsonb
    ),

    'team_targets',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'target_id', ttr.target_id,
            'auditor_user_id', ttr.auditor_user_id,
            'auditor', ttr.auditor,
            'template', ttr.template,
            'target', ttr.target,
            'completed', ttr.completed,
            'remaining', ttr.remaining,
            'progress_pct', ttr.progress_pct
          )
          order by ttr.auditor asc nulls last, ttr.remaining desc, ttr.template asc
        )
        from team_targets_rows ttr
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
            'template_name', rrr.template_name,
            'executed_by', rrr.executed_by,
            'auditor_name', rrr.auditor_name
          )
          order by rrr.executed_at desc
        )
        from recent_runs_rows rrr
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from validated_caller;

  if v_result is null then
    raise exception 'No autorizado o perfil inválido para rpc_team_summary.';
  end if;

  return v_result;
end;
$$;
