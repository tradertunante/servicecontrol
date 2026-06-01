-- Fix: period_runs in rpc_team_summary was counting draft and archived runs
-- because start_audit_run sets executed_at at creation, not at submission.
-- Add status = 'submitted' and archived_at IS NULL to align with the dashboard.

create or replace function public.rpc_team_summary(
  p_hotel_id uuid,
  p_user_id uuid,
  p_period text,
  p_area_id uuid default null
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

  scoped_areas as (
    select a.id as area_id
    from public.areas a
    join validated_caller vc on true
    where vc.role in ('admin', 'superadmin', 'quality')
      and a.hotel_id = p_hotel_id
      and coalesce(a.active, true) = true

    union

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
      and (p_area_id is null or sa.area_id = p_area_id)
  ),

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

  period_runs as (
    select
      r.id,
      r.area_id,
      r.executed_at,
      r.score,
      r.audit_template_id,
      r.executed_by
    from public.audit_runs r
    where r.hotel_id = p_hotel_id
      and r.status = 'submitted'
      and r.archived_at is null
      and r.executed_by in (select user_id from assigned_users)
      and r.area_id in (select area_id from scoped_area_ids)
      and r.executed_at is not null
      and r.executed_at >= v_start_ts
      and r.executed_at <= v_end_ts
  ),

  run_counts_by_user_template as (
    select
      pr.executed_by as auditor_user_id,
      pr.audit_template_id,
      pr.area_id,
      count(*)::int as completed_count
    from period_runs pr
    group by pr.executed_by, pr.audit_template_id, pr.area_id
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

  assignments_by_template as (
    select
      a.audit_template_id,
      coalesce(tc.name, 'Auditoría') as template,
      sum(a.target_count)::int as target
    from assignments a
    left join template_catalog tc
      on tc.id = a.audit_template_id
    group by a.audit_template_id, coalesce(tc.name, 'Auditoría')
  ),

  team_runs_by_template as (
    select
      pr.audit_template_id,
      count(*)::int as completed_count
    from period_runs pr
    where pr.audit_template_id is not null
    group by pr.audit_template_id
  ),

  template_progress_rows as (
    select
      abt.template,
      abt.target,
      coalesce(trt.completed_count, 0)::int as completed,
      greatest(abt.target - coalesce(trt.completed_count, 0), 0)::int as remaining,
      case
        when abt.target > 0
          then round((coalesce(trt.completed_count, 0)::numeric / abt.target::numeric) * 100, 2)
        else 0
      end as progress_pct
    from assignments_by_template abt
    left join team_runs_by_template trt
      on trt.audit_template_id = abt.audit_template_id
  ),

  team_targets_rows as (
    select
      a.id as target_id,
      a.user_id as auditor_user_id,
      ac.full_name as auditor,
      coalesce(tc.name, 'Auditoría') as template,
      a.target_count as target,
      coalesce(rc.completed_count, 0) as completed,
      greatest(a.target_count - least(coalesce(rc.completed_count, 0), a.target_count), 0) as remaining,
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
     and rc.area_id = a.area_id
  ),

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

  summary_row as (
    select
      coalesce((select sum(rcu.audits_done) from run_counts_by_user rcu), 0)::int as total_audits_done,
      coalesce(sum(ttr.target), 0)::int as total_targets,
      coalesce(sum(least(ttr.completed, ttr.target)), 0)::int as total_completed_targets,
      coalesce(sum(ttr.remaining), 0)::int as total_remaining,
      case
        when coalesce(sum(ttr.target), 0) > 0
          then round(
            (coalesce(sum(least(ttr.completed, ttr.target)), 0)::numeric / sum(ttr.target)::numeric) * 100,
            2
          )
        else 0
      end as global_pct
    from team_targets_rows ttr
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

    'template_progress',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'template', tpr.template,
            'target', tpr.target,
            'completed', tpr.completed,
            'remaining', tpr.remaining,
            'progress_pct', tpr.progress_pct
          )
          order by tpr.remaining desc, tpr.template asc
        )
        from template_progress_rows tpr
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

drop function if exists public.rpc_team_summary_v2(uuid, text, uuid);
drop function if exists public.rpc_team_summary_v2(uuid, text, uuid, uuid);

create or replace function public.rpc_team_summary_v2(
  p_hotel_id uuid,
  p_period  text,
  p_user_id uuid,
  p_area_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.rpc_team_summary(p_hotel_id, p_user_id, p_period, p_area_id);
$$;