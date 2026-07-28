-- ============================================================================
-- Certificados: gestión (crear/renombrar/desactivar) restringida a superadmin
-- ============================================================================
-- Contexto: el alta de certificados vivía repartida en cada builder de hotel
-- (admin/superadmin del hotel podían crear su propio certificado) y no existía
-- ningún catálogo único. Para simplificar la UX (un solo lugar,
-- /superadmin/certifications) y evitar duplicados/inconsistencias entre
-- hoteles, la gestión del catálogo pasa a ser exclusiva de superadmin y todo
-- certificado nuevo se crea con hotel_id NULL (global), igual que
-- global_audit_packs / standard_libraries.
--
-- El etiquetado de preguntas (audit_question_certifications) NO cambia: sigue
-- pudiéndolo hacer el admin del hotel dueño de la plantilla, ahora usando el
-- catálogo global en vez de crear certificados propios.
--
-- Las filas legacy con hotel_id no nulo (si existieran) se mantienen legibles
-- y siguen contando para el RPC de breakdown; solo deja de haber una vía de
-- escritura para el admin de hotel. Superadmin puede seguir editándolas
-- (rename/desactivar) para poder migrarlas/limpiarlas manualmente.
-- ============================================================================

drop policy if exists certification_standards_insert_admin_scoped on public.certification_standards;
create policy certification_standards_insert_admin_scoped
on public.certification_standards
for insert
to authenticated
with check (
  hotel_id is null and public.sc_can_manage_global_library_assets()
);

drop policy if exists certification_standards_update_admin_scoped on public.certification_standards;
create policy certification_standards_update_admin_scoped
on public.certification_standards
for update
to authenticated
using (public.sc_can_manage_global_library_assets())
with check (public.sc_can_manage_global_library_assets());

drop policy if exists certification_standards_delete_admin_scoped on public.certification_standards;
create policy certification_standards_delete_admin_scoped
on public.certification_standards
for delete
to authenticated
using (public.sc_can_manage_global_library_assets());
