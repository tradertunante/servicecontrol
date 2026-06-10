-- ============================================================================
-- Fix de seguridad RLS: eliminación de policies permisivas legacy
-- ============================================================================
-- Contexto: las migraciones de hardening (20260316140000 y posteriores) crearon
-- el set canónico de policies `*_scoped` / `*_admin_scoped` basadas en los
-- helpers `sc_*` (que derivan el hotel del actor de `profiles.hotel_id`). Sin
-- embargo, NUNCA se eliminaron las policies permisivas anteriores. Como en
-- Postgres las policies PERMISSIVE se combinan con OR, cualquier policy laxa
-- reabre el acceso, anulando el hardening. Gaps confirmados contra la BD real
-- (suite de integración, 2026-06-10):
--   • `audit_answers_update_auth` (USING/CHECK true): cualquier autenticado puede
--      MODIFICAR respuestas de auditorías de CUALQUIER hotel. (crítico)
--   • `*_select_auth` (true) en answers/sections/questions: lectura cross-hotel.
--   • `audit_runs_select_policy` / `_select_by_hotel`: auditor ve runs del hotel
--      sin tener el área asignada.
--   • `audit_sections_select_scoped` / `audit_questions_select_scoped`: mal
--      escritas, solo comprueban que la plantilla exista (sin filtrar hotel).
--   • `Insert audit_templates same hotel` / `audit_templates_write_only_hotel`:
--      cualquier rol (p.ej. auditor) puede crear/editar plantillas de su hotel.
--   • `profiles_update_own` (USING id=auth.uid()): un usuario puede cambiar su
--      propia columna `role` → auto-escalada de privilegios.
--
-- Estrategia: dejar SOLO el set canónico `sc_*`. Para `profiles` se conserva el
-- self-update (necesario para onboarding/términos) pero se blinda con un trigger
-- que impide a no-admins tocar role/hotel_id/active/is_trial. Las select de
-- sections/questions se reescriben para que filtren por hotel.
--
-- Backup de las policies previas: docs/rls-policies-backup-2026-06-10.json
-- ============================================================================

-- ── hotels ──────────────────────────────────────────────────────────────────
-- Laxas de lectura (la peor: hotels_select_authenticated = USING true).
drop policy if exists hotels_select on public.hotels;
drop policy if exists hotels_select_authenticated on public.hotels;
drop policy if exists hotels_select_if_member_or_superadmin on public.hotels;
-- Conservadas: hotels_select_scoped, hotels_select_superadmin,
-- hotels_superadmin_manage, hotels_write_superadmin, superadmin_manage_hotels.

-- ── profiles ────────────────────────────────────────────────────────────────
-- insert_own permitiría crear el propio profile con cualquier rol; el alta real
-- la hace el trigger sync_profile_from_auth_user (service-role).
drop policy if exists profiles_insert_own on public.profiles;
-- update_own se conserva para self-service, blindada por el trigger de abajo.
-- Conservadas: profiles_select_scoped, profiles_select_self,
-- profiles_select_superadmin, profiles_select_same_hotel, profiles_update_own,
-- profiles_*_admin_scoped.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin JWT (service-role) o admins del hotel: cambios permitidos.
  if auth.uid() is null then
    return new;
  end if;
  if public.sc_user_role() in ('superadmin', 'admin') then
    return new;
  end if;
  -- Un usuario normal no puede alterar campos sensibles de su propio perfil.
  if new.role is distinct from old.role
     or new.hotel_id is distinct from old.hotel_id
     or coalesce(new.active, true) is distinct from coalesce(old.active, true)
     or coalesce(new.is_trial, false) is distinct from coalesce(old.is_trial, false)
     or new.id is distinct from old.id then
    raise exception 'No autorizado a modificar role/hotel_id/active del perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_escalation on public.profiles;
create trigger trg_prevent_profile_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ── areas ───────────────────────────────────────────────────────────────────
drop policy if exists areas_select_by_hotel on public.areas;
drop policy if exists areas_select_own_hotel on public.areas;
drop policy if exists areas_modify_admin on public.areas;
drop policy if exists areas_delete_admin_manager on public.areas;
drop policy if exists areas_delete_same_hotel on public.areas;
drop policy if exists areas_insert_admin_manager on public.areas;
drop policy if exists areas_update_admin_manager on public.areas;
-- Conservadas: areas_select_scoped, areas_{insert,update,delete}_admin_scoped.

-- ── audit_templates ─────────────────────────────────────────────────────────
drop policy if exists "Insert audit_templates same hotel" on public.audit_templates;
drop policy if exists audit_templates_admin_write on public.audit_templates;
drop policy if exists audit_templates_delete_admin_manager_same_hotel on public.audit_templates;
drop policy if exists audit_templates_delete_same_hotel on public.audit_templates;
drop policy if exists audit_templates_insert_admin_manager_same_hotel on public.audit_templates;
drop policy if exists audit_templates_modify_admin on public.audit_templates;
drop policy if exists audit_templates_select_by_hotel on public.audit_templates;
drop policy if exists audit_templates_select_global_or_hotel on public.audit_templates;
drop policy if exists audit_templates_select_own_hotel on public.audit_templates;
drop policy if exists audit_templates_select_same_hotel on public.audit_templates;
drop policy if exists audit_templates_update_admin_manager_same_hotel on public.audit_templates;
drop policy if exists audit_templates_write_only_hotel on public.audit_templates;
drop policy if exists templates_select_own_hotel on public.audit_templates;
-- Conservadas: audit_templates_select_scoped (hotel_id IS NULL OR same_hotel),
-- audit_templates_{insert,update,delete}_admin_scoped (sc_can_mutate_template).

-- ── audit_sections ──────────────────────────────────────────────────────────
drop policy if exists "allow insert audit_sections" on public.audit_sections;
drop policy if exists audit_sections_admin_write on public.audit_sections;
drop policy if exists audit_sections_delete_same_hotel on public.audit_sections;
drop policy if exists audit_sections_modify_admin on public.audit_sections;
drop policy if exists audit_sections_select_auth on public.audit_sections;
drop policy if exists audit_sections_select_by_hotel on public.audit_sections;
drop policy if exists audit_sections_select_own_hotel on public.audit_sections;
-- La _scoped existente NO filtraba por hotel (solo comprobaba que la plantilla
-- exista). Se reescribe para alinearla con audit_templates_select_scoped.
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
      and (t.hotel_id is null or public.sc_is_same_hotel(t.hotel_id))
  )
);
-- Conservadas: audit_sections_{insert,update,delete}_admin_scoped.

-- ── audit_questions ─────────────────────────────────────────────────────────
drop policy if exists "allow insert audit_questions" on public.audit_questions;
drop policy if exists audit_questions_insert_admin_manager on public.audit_questions;
drop policy if exists audit_questions_insert_authenticated on public.audit_questions;
drop policy if exists audit_questions_insert_same_hotel on public.audit_questions;
drop policy if exists audit_questions_modify_admin on public.audit_questions;
drop policy if exists audit_questions_select_auth on public.audit_questions;
drop policy if exists audit_questions_select_by_hotel on public.audit_questions;
drop policy if exists audit_questions_select_same_hotel on public.audit_questions;
drop policy if exists audit_questions_delete_same_hotel on public.audit_questions;
drop policy if exists audit_questions_update_same_hotel on public.audit_questions;
-- Igual que sections: la _scoped no filtraba por hotel. Se reescribe.
drop policy if exists audit_questions_select_scoped on public.audit_questions;
create policy audit_questions_select_scoped
on public.audit_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.audit_sections s
    join public.audit_templates t on t.id = s.audit_template_id
    where s.id = audit_questions.audit_section_id
      and (t.hotel_id is null or public.sc_is_same_hotel(t.hotel_id))
  )
);
-- Conservadas: audit_questions_{insert,update,delete}_admin_scoped.

-- ── audit_runs ──────────────────────────────────────────────────────────────
drop policy if exists audit_runs_insert on public.audit_runs;
drop policy if exists audit_runs_insert_by_role_and_hotel on public.audit_runs;
drop policy if exists audit_runs_modify_admin on public.audit_runs;
drop policy if exists audit_runs_select on public.audit_runs;
drop policy if exists audit_runs_select_admin_manager_same_hotel on public.audit_runs;
drop policy if exists audit_runs_select_by_hotel on public.audit_runs;
drop policy if exists audit_runs_select_policy on public.audit_runs;
drop policy if exists audit_runs_update on public.audit_runs;
drop policy if exists audit_runs_update_by_role_and_hotel on public.audit_runs;
-- Conservadas: audit_runs_select_scoped (sc_can_view_run),
-- audit_runs_insert_scoped, audit_runs_update_scoped, audit_runs_delete_scoped.

-- ── audit_answers ───────────────────────────────────────────────────────────
drop policy if exists audit_answers_insert_auth on public.audit_answers;
drop policy if exists audit_answers_insert_by_run_hotel on public.audit_answers;
drop policy if exists audit_answers_modify_by_hotel on public.audit_answers;
drop policy if exists audit_answers_select_auth on public.audit_answers;
drop policy if exists audit_answers_select_by_hotel on public.audit_answers;
drop policy if exists audit_answers_select_by_run_hotel on public.audit_answers;
drop policy if exists audit_answers_update_auth on public.audit_answers;
drop policy if exists audit_answers_update_by_run_hotel on public.audit_answers;
-- Conservadas: audit_answers_select_scoped (sc_can_view_run),
-- audit_answers_insert_scoped, audit_answers_update_scoped, audit_answers_delete_scoped.

-- ── user_area_access ────────────────────────────────────────────────────────
drop policy if exists uaa_delete_admin_manager_same_hotel on public.user_area_access;
drop policy if exists uaa_insert_admin_manager_same_hotel on public.user_area_access;
drop policy if exists uaa_select_admin_manager_same_hotel on public.user_area_access;
-- Conservadas: user_area_access_*_scoped (4).

-- ── limpieza de la introspección temporal ───────────────────────────────────
drop function if exists public._sc_dump_policies();
drop function if exists public._sc_dump_funcs(text[]);