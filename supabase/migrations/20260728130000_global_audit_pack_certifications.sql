-- ============================================================================
-- Certificados por PACK: qué certificados (Forbes/LHW/Meliá, etc.) aplican a
-- cada pack global (ej. "Paradisus Standards" → LHW + Meliá + Forbes).
-- ============================================================================
-- Contexto: certification_standards es ahora un catálogo global único
-- (20260728120000). Sin esta tabla puente, cualquier plantilla (global o de
-- hotel) veía TODO el catálogo al etiquetar preguntas — inmanejable en cuanto
-- hay certificados de packs que no deben mezclarse (ej. "Forbes Chile" no
-- debe poder marcar preguntas como Meliá). Esta tabla asocia certificados al
-- pack donde tiene sentido usarlos; el builder resuelve qué certificados
-- mostrar a partir del pack de la plantilla (global_audit_pack_templates para
-- plantillas scope='global', audit_templates.pack_id para clones de hotel).
-- ============================================================================

create table if not exists public.global_audit_pack_certifications (
  pack_id uuid not null references public.global_audit_packs(id) on delete cascade,
  certification_standard_id uuid not null references public.certification_standards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pack_id, certification_standard_id)
);

create index if not exists global_audit_pack_certifications_cert_idx
  on public.global_audit_pack_certifications (certification_standard_id);

alter table public.global_audit_pack_certifications enable row level security;

-- Mismo patrón que global_audit_pack_templates: lectura para quien puede ver
-- la biblioteca global, escritura solo superadmin.
drop policy if exists global_audit_pack_certifications_select_scoped on public.global_audit_pack_certifications;
create policy global_audit_pack_certifications_select_scoped
on public.global_audit_pack_certifications
for select
to authenticated
using (public.sc_can_view_global_library_assets());

drop policy if exists global_audit_pack_certifications_mutate_superadmin on public.global_audit_pack_certifications;
create policy global_audit_pack_certifications_mutate_superadmin
on public.global_audit_pack_certifications
for all
to authenticated
using (public.sc_can_manage_global_library_assets())
with check (public.sc_can_manage_global_library_assets());
