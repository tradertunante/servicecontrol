create or replace function public.get_scoped_department_corrective_actions(
  p_user_id uuid,
  p_target_department_code text
)
returns table (
  corrective_action_id uuid,
  audit_run_id uuid,
  question_id uuid,
  title text,
  status text,
  assigned_department_id uuid,
  assigned_department text,
  department_code text,
  hotel_id uuid,
  area_id uuid,
  room_number text,
  audit_score numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_target_department_code text := lower(trim(coalesce(p_target_department_code, '')));
  v_assigned_department_code text := null;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Forbidden';
  end if;

  if v_target_department_code not in ('it', 'engineering') then
    raise exception 'Invalid target department code';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.id = p_user_id
  limit 1;

  if v_profile.id is null then
    return;
  end if;

  if coalesce(v_profile.active, true) is distinct from true then
    return;
  end if;

  if v_profile.hotel_id is null then
    return;
  end if;

  if v_profile.assigned_department_id is not null then
    select
      case
        when hd.code = 'systems' then 'it'
        when hd.code in ('it', 'engineering') then hd.code
        else null
      end
    into v_assigned_department_code
    from public.hotel_departments hd
    where hd.id = v_profile.assigned_department_id
    limit 1;
  end if;

  return query
  with caller_area_scope as (
    select distinct uaa.area_id
    from public.user_area_access uaa
    where uaa.hotel_id = v_profile.hotel_id
      and uaa.user_id = p_user_id
      and uaa.area_id is not null
  ),
  corrective_actions_base as (
    select
      ca.id as corrective_action_id,
      ca.audit_run_id,
      ca.question_id,
      ca.title,
      ca.status,
      ca.assigned_department_id,
      ca.assigned_department,
      coalesce(
        case
          when hd.code = 'systems' then 'it'
          when hd.code in ('it', 'engineering') then hd.code
          else null
        end,
        case
          when lower(trim(coalesce(ca.assigned_department, ''))) = 'engineering' then 'engineering'
          when lower(trim(coalesce(ca.assigned_department, ''))) in ('systems', 'it') then 'it'
          else null
        end
      ) as department_code,
      ca.hotel_id,
      ca.area_id,
      ar.room_number,
      ar.score as audit_score,
      ca.opened_at as created_at
    from public.audit_corrective_actions ca
    join public.audit_runs ar
      on ar.id = ca.audit_run_id
    left join public.hotel_departments hd
      on hd.id = ca.assigned_department_id
    where ca.hotel_id = v_profile.hotel_id
  )
  select
    cab.corrective_action_id,
    cab.audit_run_id,
    cab.question_id,
    cab.title,
    cab.status,
    cab.assigned_department_id,
    cab.assigned_department,
    cab.department_code,
    cab.hotel_id,
    cab.area_id,
    cab.room_number,
    cab.audit_score,
    cab.created_at
  from corrective_actions_base cab
  where cab.department_code = v_target_department_code
    and (
      v_assigned_department_code = v_target_department_code
      or (
        v_assigned_department_code is null
        and exists (
          select 1
          from caller_area_scope cas
          where cas.area_id = cab.area_id
        )
      )
    )
  order by cab.created_at desc;
end;
$$;
