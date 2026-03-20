create table if not exists public.hotel_departments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('operational', 'non_operational')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint hotel_departments_code_not_blank check (length(trim(code)) > 0),
  constraint hotel_departments_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists hotel_departments_hotel_code_unique
on public.hotel_departments (hotel_id, code);

create index if not exists hotel_departments_hotel_category_idx
on public.hotel_departments (hotel_id, category, code);

insert into public.hotel_departments (
  hotel_id,
  code,
  name,
  category
)
select
  h.id,
  d.code,
  d.name,
  'non_operational'
from public.hotels h
cross join (
  values
    ('engineering', 'Engineering'),
    ('it', 'IT')
) as d(code, name)
where not exists (
  select 1
  from public.hotel_departments hd
  where hd.hotel_id = h.id
    and hd.code = d.code
);

alter table public.profiles
add column if not exists assigned_department_id uuid null references public.hotel_departments(id) on delete set null;

create index if not exists profiles_assigned_department_id_idx
on public.profiles (assigned_department_id);

alter table public.audit_corrective_actions
add column if not exists assigned_department_id uuid null references public.hotel_departments(id) on delete set null;

create index if not exists audit_corrective_actions_assigned_department_id_idx
on public.audit_corrective_actions (assigned_department_id);

create or replace function public.sync_corrective_action_department_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_department_code text;
begin
  if new.assigned_department_id is not null then
    return new;
  end if;

  if new.hotel_id is null then
    return new;
  end if;

  v_department_code := case lower(trim(coalesce(new.assigned_department, '')))
    when 'engineering' then 'engineering'
    when 'systems' then 'it'
    when 'it' then 'it'
    else null
  end;

  if v_department_code is null then
    return new;
  end if;

  select hd.id
  into new.assigned_department_id
  from public.hotel_departments hd
  where hd.hotel_id = new.hotel_id
    and hd.code = v_department_code
  limit 1;

  return new;
end;
$$;

drop trigger if exists trg_sync_corrective_action_department_id on public.audit_corrective_actions;

create trigger trg_sync_corrective_action_department_id
before insert or update of hotel_id, assigned_department, assigned_department_id
on public.audit_corrective_actions
for each row
execute function public.sync_corrective_action_department_id();

update public.audit_corrective_actions ca
set assigned_department_id = hd.id
from public.hotel_departments hd
where ca.assigned_department_id is null
  and ca.hotel_id = hd.hotel_id
  and (
    (lower(trim(coalesce(ca.assigned_department, ''))) = 'engineering' and hd.code = 'engineering')
    or (lower(trim(coalesce(ca.assigned_department, ''))) in ('systems', 'it') and hd.code = 'it')
  );

update public.profiles p
set assigned_department_id = hd.id
from public.hotel_departments hd
where p.assigned_department_id is null
  and p.hotel_id = hd.hotel_id
  and (
    (lower(trim(coalesce(p.role, ''))) = 'engineering' and hd.code = 'engineering')
    or (lower(trim(coalesce(p.role, ''))) in ('systems', 'it') and hd.code = 'it')
  );

create or replace function public.get_department_corrective_actions(p_user_id uuid)
returns table (
  corrective_action_id uuid,
  audit_run_id uuid,
  question_id uuid,
  title text,
  status text,
  assigned_department_id uuid,
  assigned_department text,
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
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Forbidden';
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

  if v_profile.assigned_department_id is null then
    return;
  end if;

  return query
  select
    ca.id as corrective_action_id,
    ca.audit_run_id,
    ca.question_id,
    ca.title,
    ca.status,
    ca.assigned_department_id,
    ca.assigned_department,
    ca.hotel_id,
    ca.area_id,
    ar.room_number,
    ar.score as audit_score,
    ca.opened_at as created_at
  from public.audit_corrective_actions ca
  join public.audit_runs ar
    on ar.id = ca.audit_run_id
  where ca.hotel_id = v_profile.hotel_id
    and ca.assigned_department_id = v_profile.assigned_department_id
  order by ca.opened_at desc;
end;
$$;

create or replace view public.department_corrective_actions_view as
select
  ca.id as corrective_action_id,
  ca.audit_run_id,
  ca.question_id,
  ca.title,
  ca.status,
  ca.assigned_department_id,
  ca.assigned_department,
  d.code as department_code,
  d.name as department_name,
  ca.hotel_id,
  ca.area_id,
  ar.room_number,
  ar.score as audit_score,
  ca.opened_at as created_at,
  ar.executed_at as audit_created_at
from public.audit_corrective_actions ca
join public.hotel_departments d
  on d.id = ca.assigned_department_id
join public.audit_runs ar
  on ar.id = ca.audit_run_id;
