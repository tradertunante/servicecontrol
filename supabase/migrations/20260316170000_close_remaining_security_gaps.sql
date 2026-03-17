create or replace function public.sc_can_read_profile(target_profile uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hotel_id uuid;
  v_actor_role text;
begin
  if auth.uid() = target_profile then
    return true;
  end if;

  select p.hotel_id
  into v_hotel_id
  from public.profiles p
  where p.id = target_profile
  limit 1;

  if v_hotel_id is null then
    return false;
  end if;

  v_actor_role := public.sc_user_role();

  if v_actor_role in ('superadmin', 'admin', 'general_manager', 'manager', 'quality') then
    return public.sc_is_same_hotel(v_hotel_id);
  end if;

  return false;
end;
$$;

create or replace function public.sc_can_manage_profile(
  target_profile uuid,
  target_hotel uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.sc_user_role() = 'superadmin' then true
    when public.sc_user_role() = 'admin' then
      public.sc_is_same_hotel(target_hotel)
      and lower(trim(coalesce(target_role, ''))) <> 'superadmin'
    else false
  end;
$$;

create or replace function public.sc_can_write_profile(
  target_hotel uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.sc_user_role() = 'superadmin' then
      lower(trim(coalesce(target_role, ''))) = any(
        array['admin', 'general_manager', 'manager', 'auditor', 'quality', 'engineering', 'it', 'systems']
      )
    when public.sc_user_role() = 'admin' then
      public.sc_is_same_hotel(target_hotel)
      and lower(trim(coalesce(target_role, ''))) = any(
        array['admin', 'general_manager', 'manager', 'auditor', 'quality', 'engineering', 'it', 'systems']
      )
    else false
  end;
$$;

create or replace function public.sc_can_mutate_template(target_hotel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_hotel is null then public.sc_user_role() = 'superadmin'
    else public.sc_has_hotel_role(target_hotel, array['superadmin', 'admin'])
  end;
$$;

create or replace function public.sc_manager_has_hotel_area_scope(target_hotel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_area_access ua
    join public.areas a on a.id = ua.area_id
    where ua.user_id = auth.uid()
      and a.hotel_id = target_hotel
      and public.sc_is_same_hotel(a.hotel_id)
  );
$$;

create or replace function public.sc_can_read_team_member(
  target_member uuid,
  target_hotel uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.sc_user_role() in ('superadmin', 'admin', 'general_manager', 'quality') then
      public.sc_is_same_hotel(target_hotel)
    when public.sc_user_role() = 'manager' then
      public.sc_is_same_hotel(target_hotel)
      and exists(
        select 1
        from public.team_member_areas tma
        join public.user_area_access ua
          on ua.area_id = tma.area_id
         and ua.user_id = auth.uid()
        where tma.team_member_id = target_member
      )
    else false
  end;
$$;

create or replace function public.sc_can_write_team_member(target_hotel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.sc_user_role() in ('superadmin', 'admin', 'general_manager', 'quality') then
      public.sc_is_same_hotel(target_hotel)
    else false
  end;
$$;

create or replace function public.sc_can_read_team_member_area(
  target_member uuid,
  target_area uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.sc_user_role() in ('superadmin', 'admin', 'general_manager', 'quality') then
      exists(
        select 1
        from public.team_members tm
        where tm.id = target_member
          and public.sc_is_same_hotel(tm.hotel_id)
      )
    when public.sc_user_role() = 'manager' then
      exists(
        select 1
        from public.team_members tm
        join public.user_area_access ua
          on ua.area_id = target_area
         and ua.user_id = auth.uid()
        where tm.id = target_member
          and public.sc_is_same_hotel(tm.hotel_id)
      )
    else false
  end;
$$;

drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped
on public.profiles
for select
to authenticated
using (
  public.sc_can_read_profile(id)
);

drop policy if exists profiles_update_admin_scoped on public.profiles;
create policy profiles_update_admin_scoped
on public.profiles
for update
to authenticated
using (
  public.sc_can_manage_profile(id, hotel_id, role)
)
with check (
  public.sc_can_write_profile(hotel_id, role)
);

drop policy if exists profiles_insert_admin_scoped on public.profiles;
create policy profiles_insert_admin_scoped
on public.profiles
for insert
to authenticated
with check (
  public.sc_can_write_profile(hotel_id, role)
);

drop policy if exists profiles_delete_admin_scoped on public.profiles;
create policy profiles_delete_admin_scoped
on public.profiles
for delete
to authenticated
using (
  public.sc_can_manage_profile(id, hotel_id, role)
);

drop policy if exists audit_templates_insert_admin_scoped on public.audit_templates;
create policy audit_templates_insert_admin_scoped
on public.audit_templates
for insert
to authenticated
with check (
  public.sc_can_mutate_template(hotel_id)
);

drop policy if exists audit_templates_update_admin_scoped on public.audit_templates;
create policy audit_templates_update_admin_scoped
on public.audit_templates
for update
to authenticated
using (
  public.sc_can_mutate_template(hotel_id)
)
with check (
  public.sc_can_mutate_template(hotel_id)
);

drop policy if exists audit_templates_delete_admin_scoped on public.audit_templates;
create policy audit_templates_delete_admin_scoped
on public.audit_templates
for delete
to authenticated
using (
  public.sc_can_mutate_template(hotel_id)
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
      and public.sc_can_mutate_template(t.hotel_id)
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
      and public.sc_can_mutate_template(t.hotel_id)
  )
)
with check (
  exists (
    select 1
    from public.audit_templates t
    where t.id = audit_sections.audit_template_id
      and public.sc_can_mutate_template(t.hotel_id)
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
      and public.sc_can_mutate_template(t.hotel_id)
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
      and public.sc_can_mutate_template(t.hotel_id)
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
      and public.sc_can_mutate_template(t.hotel_id)
  )
)
with check (
  exists (
    select 1
    from public.audit_sections s
    join public.audit_templates t
      on t.id = s.audit_template_id
    where s.id = audit_questions.audit_section_id
      and public.sc_can_mutate_template(t.hotel_id)
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
      and public.sc_can_mutate_template(t.hotel_id)
  )
);

drop policy if exists team_members_select_scoped on public.team_members;
create policy team_members_select_scoped
on public.team_members
for select
to authenticated
using (
  public.sc_can_read_team_member(id, hotel_id)
);

drop policy if exists team_members_insert_scoped on public.team_members;
create policy team_members_insert_scoped
on public.team_members
for insert
to authenticated
with check (
  public.sc_can_write_team_member(hotel_id)
);

drop policy if exists team_members_update_scoped on public.team_members;
create policy team_members_update_scoped
on public.team_members
for update
to authenticated
using (
  public.sc_can_write_team_member(hotel_id)
)
with check (
  public.sc_can_write_team_member(hotel_id)
);

drop policy if exists team_members_delete_scoped on public.team_members;
create policy team_members_delete_scoped
on public.team_members
for delete
to authenticated
using (
  public.sc_can_write_team_member(hotel_id)
);

drop policy if exists team_member_areas_select_scoped on public.team_member_areas;
create policy team_member_areas_select_scoped
on public.team_member_areas
for select
to authenticated
using (
  public.sc_can_read_team_member_area(team_member_id, area_id)
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
      and public.sc_can_write_team_member(tm.hotel_id)
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
      and public.sc_can_write_team_member(tm.hotel_id)
  )
);
