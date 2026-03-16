create or replace function public.sc_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(p.role, '')))
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.active, true) = true
  limit 1;
$$;

create or replace function public.sc_user_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.hotel_id
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.active, true) = true
  limit 1;
$$;

create or replace function public.sc_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.sc_user_role() = any(allowed_roles), false);
$$;

create or replace function public.sc_is_same_hotel(target_hotel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.sc_user_role() = 'superadmin' then true
    else public.sc_user_hotel_id() = target_hotel
  end;
$$;

create or replace function public.sc_has_hotel_role(target_hotel uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sc_has_role(allowed_roles)
    and public.sc_is_same_hotel(target_hotel);
$$;

create or replace function public.sc_has_area_assignment(target_area uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_area_access ua
    join public.areas a
      on a.id = ua.area_id
    where ua.user_id = auth.uid()
      and ua.area_id = target_area
      and public.sc_is_same_hotel(a.hotel_id)
  );
$$;

create or replace function public.sc_can_view_area(target_area uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
  v_role text;
begin
  select a.hotel_id
  into v_hotel_id
  from public.areas a
  where a.id = target_area
  limit 1;

  if v_hotel_id is null then
    return false;
  end if;

  v_role := public.sc_user_role();

  if v_role in ('superadmin', 'admin', 'general_manager', 'manager', 'quality') then
    return public.sc_is_same_hotel(v_hotel_id);
  end if;

  if v_role in ('auditor', 'engineering', 'systems', 'it') then
    return public.sc_is_same_hotel(v_hotel_id)
      and public.sc_has_area_assignment(target_area);
  end if;

  return false;
end;
$$;

create or replace function public.sc_can_view_run(target_run uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.audit_runs ar
    where ar.id = target_run
      and public.sc_has_role(array['superadmin', 'admin', 'general_manager', 'manager', 'auditor', 'quality'])
      and public.sc_can_view_area(ar.area_id)
  );
$$;

create or replace function public.sc_can_mutate_run(target_run uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.audit_runs ar
    where ar.id = target_run
      and public.sc_has_role(array['superadmin', 'admin', 'manager', 'auditor', 'quality'])
      and public.sc_can_view_area(ar.area_id)
  );
$$;

create or replace function public.sc_can_manage_members(target_hotel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sc_has_hotel_role(
    target_hotel,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality']
  );
$$;

create or replace function public.sc_can_read_corrective_action(target_action uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
  v_area_id uuid;
  v_role text;
begin
  select ca.hotel_id, ca.area_id
  into v_hotel_id, v_area_id
  from public.audit_corrective_actions ca
  where ca.id = target_action
  limit 1;

  if v_hotel_id is null then
    return false;
  end if;

  v_role := public.sc_user_role();

  if v_role in ('superadmin', 'admin', 'general_manager', 'quality') then
    return public.sc_is_same_hotel(v_hotel_id);
  end if;

  if v_role = 'manager' then
    return public.sc_is_same_hotel(v_hotel_id)
      and public.sc_has_area_assignment(v_area_id);
  end if;

  return false;
end;
$$;

alter table public.hotels enable row level security;
alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.user_area_access enable row level security;
alter table public.audit_templates enable row level security;
alter table public.audit_sections enable row level security;
alter table public.audit_questions enable row level security;
alter table public.audit_runs enable row level security;
alter table public.audit_answers enable row level security;
alter table public.audit_corrective_actions enable row level security;
alter table public.area_template_targets enable row level security;
alter table public.area_template_target_assignments enable row level security;
alter table public.team_members enable row level security;
alter table public.team_member_areas enable row level security;
alter table public.reaudit_training_logs enable row level security;
alter table public.reaudit_assignment_logs enable row level security;

drop policy if exists hotels_select_scoped on public.hotels;
create policy hotels_select_scoped
on public.hotels
for select
to authenticated
using (
  public.sc_is_same_hotel(id)
);

drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.sc_is_same_hotel(hotel_id)
);

drop policy if exists profiles_update_admin_scoped on public.profiles;
create policy profiles_update_admin_scoped
on public.profiles
for update
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
)
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists profiles_insert_admin_scoped on public.profiles;
create policy profiles_insert_admin_scoped
on public.profiles
for insert
to authenticated
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists profiles_delete_admin_scoped on public.profiles;
create policy profiles_delete_admin_scoped
on public.profiles
for delete
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists areas_select_scoped on public.areas;
create policy areas_select_scoped
on public.areas
for select
to authenticated
using (
  public.sc_can_view_area(id)
);

drop policy if exists areas_insert_admin_scoped on public.areas;
create policy areas_insert_admin_scoped
on public.areas
for insert
to authenticated
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists areas_update_admin_scoped on public.areas;
create policy areas_update_admin_scoped
on public.areas
for update
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
)
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists areas_delete_admin_scoped on public.areas;
create policy areas_delete_admin_scoped
on public.areas
for delete
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists user_area_access_select_scoped on public.user_area_access;
create policy user_area_access_select_scoped
on public.user_area_access
for select
to authenticated
using (
  user_id = auth.uid()
  or public.sc_has_hotel_role(
    hotel_id,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality']
  )
);

drop policy if exists user_area_access_insert_admin_scoped on public.user_area_access;
create policy user_area_access_insert_admin_scoped
on public.user_area_access
for insert
to authenticated
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists user_area_access_update_admin_scoped on public.user_area_access;
create policy user_area_access_update_admin_scoped
on public.user_area_access
for update
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
)
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists user_area_access_delete_admin_scoped on public.user_area_access;
create policy user_area_access_delete_admin_scoped
on public.user_area_access
for delete
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists audit_templates_select_scoped on public.audit_templates;
create policy audit_templates_select_scoped
on public.audit_templates
for select
to authenticated
using (
  hotel_id is null
  or public.sc_is_same_hotel(hotel_id)
);

drop policy if exists audit_templates_insert_admin_scoped on public.audit_templates;
create policy audit_templates_insert_admin_scoped
on public.audit_templates
for insert
to authenticated
with check (
  hotel_id is null
  or public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists audit_templates_update_admin_scoped on public.audit_templates;
create policy audit_templates_update_admin_scoped
on public.audit_templates
for update
to authenticated
using (
  hotel_id is null
  or public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
)
with check (
  hotel_id is null
  or public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists audit_templates_delete_admin_scoped on public.audit_templates;
create policy audit_templates_delete_admin_scoped
on public.audit_templates
for delete
to authenticated
using (
  hotel_id is null
  or public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists audit_sections_select_scoped on public.audit_sections;
create policy audit_sections_select_scoped
on public.audit_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.audit_templates t
    where t.id = audit_sections.audit_template_id
  )
);

drop policy if exists audit_sections_insert_admin_scoped on public.audit_sections;
create policy audit_sections_insert_admin_scoped
on public.audit_sections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.audit_templates t
    where t.id = audit_sections.audit_template_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
);

drop policy if exists audit_sections_update_admin_scoped on public.audit_sections;
create policy audit_sections_update_admin_scoped
on public.audit_sections
for update
to authenticated
using (
  exists (
    select 1
    from public.audit_templates t
    where t.id = audit_sections.audit_template_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
)
with check (
  exists (
    select 1
    from public.audit_templates t
    where t.id = audit_sections.audit_template_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
);

drop policy if exists audit_sections_delete_admin_scoped on public.audit_sections;
create policy audit_sections_delete_admin_scoped
on public.audit_sections
for delete
to authenticated
using (
  exists (
    select 1
    from public.audit_templates t
    where t.id = audit_sections.audit_template_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
);

drop policy if exists audit_questions_select_scoped on public.audit_questions;
create policy audit_questions_select_scoped
on public.audit_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.audit_sections s
    join public.audit_templates t
      on t.id = s.audit_template_id
    where s.id = audit_questions.audit_section_id
  )
);

drop policy if exists audit_questions_insert_admin_scoped on public.audit_questions;
create policy audit_questions_insert_admin_scoped
on public.audit_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.audit_sections s
    join public.audit_templates t
      on t.id = s.audit_template_id
    where s.id = audit_questions.audit_section_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
);

drop policy if exists audit_questions_update_admin_scoped on public.audit_questions;
create policy audit_questions_update_admin_scoped
on public.audit_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.audit_sections s
    join public.audit_templates t
      on t.id = s.audit_template_id
    where s.id = audit_questions.audit_section_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
)
with check (
  exists (
    select 1
    from public.audit_sections s
    join public.audit_templates t
      on t.id = s.audit_template_id
    where s.id = audit_questions.audit_section_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
);

drop policy if exists audit_questions_delete_admin_scoped on public.audit_questions;
create policy audit_questions_delete_admin_scoped
on public.audit_questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.audit_sections s
    join public.audit_templates t
      on t.id = s.audit_template_id
    where s.id = audit_questions.audit_section_id
      and (
        t.hotel_id is null
        or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin'])
      )
  )
);

drop policy if exists audit_runs_select_scoped on public.audit_runs;
create policy audit_runs_select_scoped
on public.audit_runs
for select
to authenticated
using (
  public.sc_can_view_run(id)
);

drop policy if exists audit_runs_insert_scoped on public.audit_runs;
create policy audit_runs_insert_scoped
on public.audit_runs
for insert
to authenticated
with check (
  public.sc_has_role(array['superadmin', 'admin', 'manager', 'auditor', 'quality'])
  and public.sc_can_view_area(area_id)
);

drop policy if exists audit_runs_update_scoped on public.audit_runs;
create policy audit_runs_update_scoped
on public.audit_runs
for update
to authenticated
using (
  public.sc_can_mutate_run(id)
)
with check (
  public.sc_can_mutate_run(id)
);

drop policy if exists audit_runs_delete_scoped on public.audit_runs;
create policy audit_runs_delete_scoped
on public.audit_runs
for delete
to authenticated
using (
  public.sc_has_role(array['superadmin', 'admin'])
  and public.sc_can_view_area(area_id)
);

drop policy if exists audit_answers_select_scoped on public.audit_answers;
create policy audit_answers_select_scoped
on public.audit_answers
for select
to authenticated
using (
  public.sc_can_view_run(audit_run_id)
);

drop policy if exists audit_answers_insert_scoped on public.audit_answers;
create policy audit_answers_insert_scoped
on public.audit_answers
for insert
to authenticated
with check (
  public.sc_can_mutate_run(audit_run_id)
);

drop policy if exists audit_answers_update_scoped on public.audit_answers;
create policy audit_answers_update_scoped
on public.audit_answers
for update
to authenticated
using (
  public.sc_can_mutate_run(audit_run_id)
)
with check (
  public.sc_can_mutate_run(audit_run_id)
);

drop policy if exists audit_answers_delete_scoped on public.audit_answers;
create policy audit_answers_delete_scoped
on public.audit_answers
for delete
to authenticated
using (
  public.sc_has_role(array['superadmin', 'admin'])
  and public.sc_can_mutate_run(audit_run_id)
);

drop policy if exists audit_corrective_actions_select_scoped on public.audit_corrective_actions;
create policy audit_corrective_actions_select_scoped
on public.audit_corrective_actions
for select
to authenticated
using (
  public.sc_can_read_corrective_action(id)
);

drop policy if exists audit_corrective_actions_update_scoped on public.audit_corrective_actions;
create policy audit_corrective_actions_update_scoped
on public.audit_corrective_actions
for update
to authenticated
using (
  public.sc_can_read_corrective_action(id)
)
with check (
  public.sc_can_read_corrective_action(id)
);

drop policy if exists area_template_targets_select_scoped on public.area_template_targets;
create policy area_template_targets_select_scoped
on public.area_template_targets
for select
to authenticated
using (
  public.sc_has_hotel_role(
    hotel_id,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality', 'auditor']
  )
);

drop policy if exists area_template_targets_insert_admin_scoped on public.area_template_targets;
create policy area_template_targets_insert_admin_scoped
on public.area_template_targets
for insert
to authenticated
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists area_template_targets_update_admin_scoped on public.area_template_targets;
create policy area_template_targets_update_admin_scoped
on public.area_template_targets
for update
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
)
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists area_template_targets_delete_admin_scoped on public.area_template_targets;
create policy area_template_targets_delete_admin_scoped
on public.area_template_targets
for delete
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists area_template_target_assignments_select_scoped on public.area_template_target_assignments;
create policy area_template_target_assignments_select_scoped
on public.area_template_target_assignments
for select
to authenticated
using (
  public.sc_has_hotel_role(
    hotel_id,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality', 'auditor']
  )
);

drop policy if exists area_template_target_assignments_insert_admin_scoped on public.area_template_target_assignments;
create policy area_template_target_assignments_insert_admin_scoped
on public.area_template_target_assignments
for insert
to authenticated
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists area_template_target_assignments_update_admin_scoped on public.area_template_target_assignments;
create policy area_template_target_assignments_update_admin_scoped
on public.area_template_target_assignments
for update
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
)
with check (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists area_template_target_assignments_delete_admin_scoped on public.area_template_target_assignments;
create policy area_template_target_assignments_delete_admin_scoped
on public.area_template_target_assignments
for delete
to authenticated
using (
  public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin'])
);

drop policy if exists team_members_select_scoped on public.team_members;
create policy team_members_select_scoped
on public.team_members
for select
to authenticated
using (
  public.sc_is_same_hotel(hotel_id)
);

drop policy if exists team_members_insert_scoped on public.team_members;
create policy team_members_insert_scoped
on public.team_members
for insert
to authenticated
with check (
  public.sc_can_manage_members(hotel_id)
);

drop policy if exists team_members_update_scoped on public.team_members;
create policy team_members_update_scoped
on public.team_members
for update
to authenticated
using (
  public.sc_can_manage_members(hotel_id)
)
with check (
  public.sc_can_manage_members(hotel_id)
);

drop policy if exists team_members_delete_scoped on public.team_members;
create policy team_members_delete_scoped
on public.team_members
for delete
to authenticated
using (
  public.sc_can_manage_members(hotel_id)
);

drop policy if exists team_member_areas_select_scoped on public.team_member_areas;
create policy team_member_areas_select_scoped
on public.team_member_areas
for select
to authenticated
using (
  exists (
    select 1
    from public.team_members tm
    where tm.id = team_member_areas.team_member_id
      and public.sc_is_same_hotel(tm.hotel_id)
  )
);

drop policy if exists team_member_areas_insert_scoped on public.team_member_areas;
create policy team_member_areas_insert_scoped
on public.team_member_areas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.team_members tm
    where tm.id = team_member_areas.team_member_id
      and public.sc_can_manage_members(tm.hotel_id)
  )
);

drop policy if exists team_member_areas_delete_scoped on public.team_member_areas;
create policy team_member_areas_delete_scoped
on public.team_member_areas
for delete
to authenticated
using (
  exists (
    select 1
    from public.team_members tm
    where tm.id = team_member_areas.team_member_id
      and public.sc_can_manage_members(tm.hotel_id)
  )
);

drop policy if exists reaudit_training_logs_select_scoped on public.reaudit_training_logs;
create policy reaudit_training_logs_select_scoped
on public.reaudit_training_logs
for select
to authenticated
using (
  public.sc_has_hotel_role(
    hotel_id,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality']
  )
);

drop policy if exists reaudit_training_logs_insert_scoped on public.reaudit_training_logs;
create policy reaudit_training_logs_insert_scoped
on public.reaudit_training_logs
for insert
to authenticated
with check (
  public.sc_has_hotel_role(
    hotel_id,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality']
  )
);

drop policy if exists reaudit_assignment_logs_select_scoped on public.reaudit_assignment_logs;
create policy reaudit_assignment_logs_select_scoped
on public.reaudit_assignment_logs
for select
to authenticated
using (
  public.sc_has_hotel_role(
    hotel_id,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality']
  )
);

drop policy if exists reaudit_assignment_logs_insert_scoped on public.reaudit_assignment_logs;
create policy reaudit_assignment_logs_insert_scoped
on public.reaudit_assignment_logs
for insert
to authenticated
with check (
  public.sc_has_hotel_role(
    hotel_id,
    array['superadmin', 'admin', 'general_manager', 'manager', 'quality']
  )
);
