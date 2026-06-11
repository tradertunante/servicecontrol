-- ============================================================================
-- RLS hardening fase 2: superficies secundarias y tablas legacy
-- ============================================================================
-- Continuación de 20260610120000 (que eliminó las policies permisivas legacy
-- del flujo principal de auditorías). Esta migración cierra los gaps restantes
-- detectados en la revisión completa de RLS: docs/rls-review-2026-06-10.md.
--
-- CRÍTICOS (fuga cross-hotel):
--   • audit_targets: `audit_targets_select` (USING true) permitía leer los
--     objetivos de cualquier hotel; las *_admin_quality solo comprobaban rol
--     (sin hotel) → un admin/quality del hotel A podía crear/editar/borrar
--     targets del hotel B; update_staff tenía WITH CHECK (true), permitiendo
--     mover una fila a otro hotel_id.
--   • hotel_settings: las policies "Authenticated users can ..." solo exigían
--     sesión → cualquier autenticado podía leer y MODIFICAR la configuración
--     de cualquier hotel.
--   • user_area_permissions / user_audit_permissions: *_admin_write usaban
--     is_admin() sin acotar hotel → escritura cross-hotel para cualquier admin.
--   • Varias tablas no tienen constancia en migraciones de RLS habilitado
--     (area_targets, area_target_assignments, global_packs,
--     global_pack_templates, hotel_quality_thresholds): si está deshabilitado
--     en prod, PostgREST las expone por completo. Se habilita idempotentemente.
--
-- MEDIOS (exceso de privilegio intra-hotel):
--   • departments / team_members / team_member_areas: cualquier rol del hotel
--     (p.ej. auditor) podía escribir; se deja solo el set sc_* canónico.
--   • reaudit_*_logs: lectura legacy abierta a todos los roles del hotel.
--   • standards / standard_*: policies legacy dependían de helpers
--     pre-hardening (is_admin, has_hotel_access, current_hotel_id,
--     can_admin_hotel) cuya definición no está versionada; se reescriben con
--     los helpers sc_* conservando la semántica (scope global legible por
--     cualquier autenticado; scope hotel solo por el propio hotel).
--   • hotel_memberships: modelo multi-hotel legacy sin uso en la app; queda
--     superadmin-only + lectura de la propia membresía.
--   • profiles_select_same_hotel: exponía email/rol de todos los compañeros a
--     cualquier rol; la lectura queda cubierta por profiles_select_self y
--     sc_can_read_profile (roles elevados).
--
-- Verificado por grep (app/, components/, hooks/, lib/): el cliente de
-- navegador NO consulta ninguna de las tablas endurecidas aquí salvo
-- standard_libraries/templates/sections/questions (app/(app)/standards/[id]),
-- cuya semántica de lectura se conserva. training_* y hotel_quality_thresholds
-- se acceden solo con service role (bypass de RLS).
-- ============================================================================

-- ── 0. RLS habilitado (idempotente) en todas las tablas sin constancia ──────
-- Tablas SIN policies: quedan deny-all para anon/authenticated; la app las usa
-- solo con service role o no las usa (legacy).
alter table public.area_targets enable row level security;
alter table public.area_target_assignments enable row level security;
alter table public.global_packs enable row level security;
alter table public.global_pack_templates enable row level security;
alter table public.hotel_quality_thresholds enable row level security;
-- Tablas CON policies creadas vía dashboard (sin ALTER en migraciones); el
-- enable es no-op si ya estaba activo:
alter table public.audit_targets enable row level security;
alter table public.audit_evidence enable row level security;
alter table public.departments enable row level security;
alter table public.hotel_audit_rules enable row level security;
alter table public.hotel_memberships enable row level security;
alter table public.hotel_settings enable row level security;
alter table public.standards enable row level security;
alter table public.superadmins enable row level security;
alter table public.user_area_permissions enable row level security;
alter table public.user_audit_permissions enable row level security;
alter table public.user_hotels enable row level security;
alter table public.user_scores enable row level security;
alter table public.score_events enable row level security;

-- ── 1. audit_targets (CRÍTICO) ──────────────────────────────────────────────
-- Fuera: select universal y escrituras solo-por-rol sin hotel.
drop policy if exists audit_targets_select on public.audit_targets;
drop policy if exists audit_targets_insert_admin_quality on public.audit_targets;
drop policy if exists audit_targets_update_admin_quality on public.audit_targets;
drop policy if exists audit_targets_delete_admin_quality on public.audit_targets;
-- Las *_staff estaban bien acotadas salvo update (WITH CHECK true). Se
-- sustituyen por el patrón sc_* para unificar criterio: gestionan objetivos
-- los roles admin/quality de su hotel (superadmin cross-hotel vía helper).
drop policy if exists audit_targets_select_staff on public.audit_targets;
drop policy if exists audit_targets_insert_staff on public.audit_targets;
drop policy if exists audit_targets_update_staff on public.audit_targets;
drop policy if exists audit_targets_delete_staff on public.audit_targets;

create policy audit_targets_select_scoped
on public.audit_targets
for select
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin', 'quality']));

create policy audit_targets_insert_admin_scoped
on public.audit_targets
for insert
to authenticated
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin', 'quality']));

create policy audit_targets_update_admin_scoped
on public.audit_targets
for update
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin', 'quality']))
-- WITH CHECK sobre la fila NUEVA: impide reasignar hotel_id a otro hotel.
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin', 'quality']));

create policy audit_targets_delete_admin_scoped
on public.audit_targets
for delete
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin', 'quality']));

-- ── 2. hotel_settings (CRÍTICO) ─────────────────────────────────────────────
drop policy if exists "Authenticated users can view hotel settings" on public.hotel_settings;
drop policy if exists "Authenticated users can insert hotel settings" on public.hotel_settings;
drop policy if exists "Authenticated users can update hotel settings" on public.hotel_settings;

-- Lectura: cualquier rol del propio hotel (branding/idioma se necesita para
-- pintar la UI). Escritura: solo admin del hotel (y superadmin).
create policy hotel_settings_select_scoped
on public.hotel_settings
for select
to authenticated
using (public.sc_is_same_hotel(hotel_id));

create policy hotel_settings_insert_admin_scoped
on public.hotel_settings
for insert
to authenticated
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

create policy hotel_settings_update_admin_scoped
on public.hotel_settings
for update
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));
-- Sin policy de DELETE: el borrado de settings no es un flujo de la app.

-- ── 3. user_area_permissions / user_audit_permissions (CRÍTICO) ─────────────
-- Las tablas no tienen hotel_id: se acota a través del hotel del usuario
-- objetivo (profiles.hotel_id), igual que hace la app con user_area_access.
drop policy if exists uarep_admin_write on public.user_area_permissions;
drop policy if exists uarep_select on public.user_area_permissions;

create policy user_area_permissions_select_scoped
on public.user_area_permissions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles tp
    where tp.id = user_area_permissions.user_id
      and public.sc_has_hotel_role(tp.hotel_id, array['superadmin', 'admin'])
  )
);

create policy user_area_permissions_write_admin_scoped
on public.user_area_permissions
for all
to authenticated
using (
  exists (
    select 1 from public.profiles tp
    where tp.id = user_area_permissions.user_id
      and public.sc_has_hotel_role(tp.hotel_id, array['superadmin', 'admin'])
  )
)
with check (
  exists (
    select 1 from public.profiles tp
    where tp.id = user_area_permissions.user_id
      and public.sc_has_hotel_role(tp.hotel_id, array['superadmin', 'admin'])
  )
);

drop policy if exists uap_admin_write on public.user_audit_permissions;
drop policy if exists uap_select on public.user_audit_permissions;

create policy user_audit_permissions_select_scoped
on public.user_audit_permissions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles tp
    where tp.id = user_audit_permissions.user_id
      and public.sc_has_hotel_role(tp.hotel_id, array['superadmin', 'admin'])
  )
);

create policy user_audit_permissions_write_admin_scoped
on public.user_audit_permissions
for all
to authenticated
using (
  exists (
    select 1 from public.profiles tp
    where tp.id = user_audit_permissions.user_id
      and public.sc_has_hotel_role(tp.hotel_id, array['superadmin', 'admin'])
  )
)
with check (
  exists (
    select 1 from public.profiles tp
    where tp.id = user_audit_permissions.user_id
      and public.sc_has_hotel_role(tp.hotel_id, array['superadmin', 'admin'])
  )
);

-- ── 4. departments (MEDIO: cualquier rol del hotel podía escribir) ──────────
drop policy if exists departments_select on public.departments;
drop policy if exists departments_insert on public.departments;
drop policy if exists departments_update on public.departments;
drop policy if exists departments_delete on public.departments;

-- Lectura para todo el hotel (la visibilidad por departamento la resuelven
-- los RPC); escritura solo admin, alineado con areas_*_admin_scoped.
create policy departments_select_scoped
on public.departments
for select
to authenticated
using (public.sc_is_same_hotel(hotel_id));

create policy departments_insert_admin_scoped
on public.departments
for insert
to authenticated
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

create policy departments_update_admin_scoped
on public.departments
for update
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

create policy departments_delete_admin_scoped
on public.departments
for delete
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

-- ── 5. team_members / team_member_areas (MEDIO) ─────────────────────────────
-- Las legacy permitían a CUALQUIER rol del hotel escribir la plantilla de
-- empleados. Queda el set canónico: sc_can_read_team_member (elevados todo el
-- hotel, manager solo sus áreas) y sc_can_write_team_member
-- (superadmin/admin/GM/quality). El formulario de auditoría obtiene los
-- colaboradores vía RPC/route handler, no le afecta.
drop policy if exists team_members_select on public.team_members;
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;

drop policy if exists tma_select on public.team_member_areas;
drop policy if exists tma_insert on public.team_member_areas;
drop policy if exists tma_delete on public.team_member_areas;

-- ── 6. reaudit_training_logs / reaudit_assignment_logs (MEDIO) ──────────────
-- La lectura legacy ("read ... by hotel") la tenía cualquier rol del hotel;
-- el set _scoped la limita a superadmin/admin/GM/manager/quality. El insert
-- legacy era redundante con el _scoped.
drop policy if exists "read reaudit training logs by hotel" on public.reaudit_training_logs;
drop policy if exists "insert reaudit training logs by hotel roles" on public.reaudit_training_logs;
drop policy if exists "read reaudit assignment logs by hotel" on public.reaudit_assignment_logs;
drop policy if exists "insert reaudit assignment logs by hotel roles" on public.reaudit_assignment_logs;

-- ── 7. standards (tabla legacy, sin uso en la app) ──────────────────────────
-- Dependían de has_hotel_access/is_admin/current_hotel_id (sin versionar).
drop policy if exists standards_admin_write on public.standards;
drop policy if exists standards_modify_admin on public.standards;
drop policy if exists standards_select_by_hotel on public.standards;
drop policy if exists standards_select_own_hotel on public.standards;

create policy standards_select_scoped
on public.standards
for select
to authenticated
using (public.sc_is_same_hotel(hotel_id));

create policy standards_write_admin_scoped
on public.standards
for all
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

-- ── 8. standard_libraries / standard_templates / standard_sections /
--       standard_questions (MEDIO: reescritura con helpers sc_*) ─────────────
-- La página app/(app)/standards/[id] lee estas tablas con el cliente de
-- navegador: se conserva la semántica de lectura (global para cualquier
-- autenticado; hotel solo para el propio hotel). La escritura de scope hotel
-- pasa de can_admin_hotel (sin versionar) a admin del hotel; la de scope
-- global sigue siendo superadmin (ya cubierta por *_mutate_superadmin).
drop policy if exists "admin manage standards" on public.standard_libraries;
drop policy if exists "read standards" on public.standard_libraries;
drop policy if exists libraries_select on public.standard_libraries;
drop policy if exists libraries_insert on public.standard_libraries;
drop policy if exists libraries_update on public.standard_libraries;
drop policy if exists libraries_delete on public.standard_libraries;

create policy standard_libraries_select_hotel_scoped
on public.standard_libraries
for select
to authenticated
using (
  scope = 'global'
  or (scope = 'hotel' and public.sc_is_same_hotel(hotel_id))
);

create policy standard_libraries_write_admin_scoped
on public.standard_libraries
for all
to authenticated
using (
  (scope = 'global' and public.sc_has_role(array['superadmin']))
  or (scope = 'hotel' and public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
)
with check (
  (scope = 'global' and public.sc_has_role(array['superadmin']))
  or (scope = 'hotel' and public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
);

drop policy if exists templates_select on public.standard_templates;
drop policy if exists templates_insert on public.standard_templates;
drop policy if exists templates_update on public.standard_templates;
drop policy if exists templates_delete on public.standard_templates;

create policy standard_templates_select_hotel_scoped
on public.standard_templates
for select
to authenticated
using (
  scope = 'global'
  or (scope = 'hotel' and public.sc_is_same_hotel(hotel_id))
);

create policy standard_templates_write_admin_scoped
on public.standard_templates
for all
to authenticated
using (
  (scope = 'global' and public.sc_has_role(array['superadmin']))
  or (scope = 'hotel' and public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
)
with check (
  (scope = 'global' and public.sc_has_role(array['superadmin']))
  or (scope = 'hotel' and public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
);

drop policy if exists sections_select on public.standard_sections;
create policy standard_sections_select_hotel_scoped
on public.standard_sections
for select
to authenticated
using (
  exists (
    select 1 from public.standard_templates t
    where t.id = standard_sections.template_id
      and (
        t.scope = 'global'
        or (t.scope = 'hotel' and public.sc_is_same_hotel(t.hotel_id))
      )
  )
);

drop policy if exists questions_select on public.standard_questions;
create policy standard_questions_select_hotel_scoped
on public.standard_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.standard_sections s
    join public.standard_templates t on t.id = s.template_id
    where s.id = standard_questions.section_id
      and (
        t.scope = 'global'
        or (t.scope = 'hotel' and public.sc_is_same_hotel(t.hotel_id))
      )
  )
);

-- ── 9. audit_evidence (tabla legacy; la evidencia actual va a Storage) ──────
-- Las policies usaban current_hotel_id/is_admin y no exigían rol para leer.
-- Se alinean con la visibilidad real de runs (sc_can_view_run / sc_can_mutate_run).
drop policy if exists audit_evidence_select_own_hotel on public.audit_evidence;
drop policy if exists audit_evidence_insert_owner_or_admin on public.audit_evidence;

create policy audit_evidence_select_scoped
on public.audit_evidence
for select
to authenticated
using (
  exists (
    select 1 from public.audit_answers a
    where a.id = audit_evidence.audit_answer_id
      and public.sc_can_view_run(a.audit_run_id)
  )
);

create policy audit_evidence_insert_scoped
on public.audit_evidence
for insert
to authenticated
with check (
  exists (
    select 1 from public.audit_answers a
    where a.id = audit_evidence.audit_answer_id
      and public.sc_can_mutate_run(a.audit_run_id)
  )
);

-- ── 10. hotel_memberships (modelo multi-hotel legacy, sin uso en la app) ────
-- Las legacy delegaban en hotel_role()/is_hotel_member() (sin versionar) y
-- permitían a "hotel admins" gestionar membresías. Queda: superadmin gestiona
-- todo (hm_superadmin_manage) y cada usuario lee su propia membresía
-- (hm_select_own_or_superadmin).
drop policy if exists memberships_select on public.hotel_memberships;
drop policy if exists memberships_insert on public.hotel_memberships;
drop policy if exists memberships_update on public.hotel_memberships;
drop policy if exists memberships_write on public.hotel_memberships;
drop policy if exists memberships_delete on public.hotel_memberships;

-- ── 11. profiles: retirar lectura same-hotel universal (MEDIO) ──────────────
-- Exponía email/rol de toda la plantilla a cualquier rol (auditor incluido).
-- profiles_select_self + profiles_select_scoped (sc_can_read_profile: roles
-- elevados del mismo hotel) cubren los flujos reales; los listados de usuarios
-- van por route handlers con service role.
drop policy if exists profiles_select_same_hotel on public.profiles;