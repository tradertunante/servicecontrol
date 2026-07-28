-- ============================================================================
-- Certificaciones transversales por pregunta (Forbes / LHW / Meliá, etc.)
-- ============================================================================
-- Contexto: un hotel quiere fusionar los checklists de varios sellos de
-- calidad (p.ej. Forbes Travel Standards, LHW, estándar de marca Meliá) en
-- una única auditoría. Cada pregunta puede aplicar a uno, varios o ninguno
-- de esos certificados ("limpieza de baño" → Forbes+LHW+Meliá, "saludo con
-- mano en el corazón" → solo Meliá). La auditoría se responde una sola vez;
-- el resultado de cumplimiento se calcula de forma independiente por
-- certificado a partir de las mismas respuestas (ver RPC más abajo).
--
-- certification_standards: catálogo de certificados, configurable por hotel
--   (no un enum fijo en código, para que cada hotel defina su propia
--   combinación de sellos).
-- audit_question_certifications: relación muchos-a-muchos pregunta↔certificado.
--
-- Nombrado como "certification_standards" (no "standards") para no chocar
-- con la tabla legacy `standards` (sin uso, ver 20260610140000) ni con la
-- columna `audit_questions.tag`/UI "standard" (que en el builder es en
-- realidad el texto redactado de la pregunta, app/(app)/builder/[templateId]).
-- ============================================================================

create table if not exists public.certification_standards (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint certification_standards_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists certification_standards_hotel_name_uniq
  on public.certification_standards (hotel_id, lower(btrim(name)));

create index if not exists certification_standards_hotel_id_idx
  on public.certification_standards (hotel_id);

create table if not exists public.audit_question_certifications (
  question_id uuid not null references public.audit_questions(id) on delete cascade,
  certification_standard_id uuid not null references public.certification_standards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, certification_standard_id)
);

create index if not exists audit_question_certifications_standard_idx
  on public.audit_question_certifications (certification_standard_id);

alter table public.certification_standards enable row level security;
alter table public.audit_question_certifications enable row level security;

-- ── certification_standards: lectura para el hotel, escritura solo admin ───
drop policy if exists certification_standards_select_scoped on public.certification_standards;
create policy certification_standards_select_scoped
on public.certification_standards
for select
to authenticated
using (public.sc_is_same_hotel(hotel_id));

drop policy if exists certification_standards_insert_admin_scoped on public.certification_standards;
create policy certification_standards_insert_admin_scoped
on public.certification_standards
for insert
to authenticated
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

drop policy if exists certification_standards_update_admin_scoped on public.certification_standards;
create policy certification_standards_update_admin_scoped
on public.certification_standards
for update
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']))
with check (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

drop policy if exists certification_standards_delete_admin_scoped on public.certification_standards;
create policy certification_standards_delete_admin_scoped
on public.certification_standards
for delete
to authenticated
using (public.sc_has_hotel_role(hotel_id, array['superadmin', 'admin']));

-- ── audit_question_certifications: mismo patrón que audit_questions ────────
-- (lectura abierta a autenticados vía join, escritura restringida a
-- admin/superadmin del hotel dueño de la plantilla, ver 20260316140000).
drop policy if exists audit_question_certifications_select_scoped on public.audit_question_certifications;
create policy audit_question_certifications_select_scoped
on public.audit_question_certifications
for select
to authenticated
using (
  exists (
    select 1
    from public.audit_questions q
    join public.audit_sections s on s.id = q.audit_section_id
    where q.id = audit_question_certifications.question_id
  )
);

drop policy if exists audit_question_certifications_insert_admin_scoped on public.audit_question_certifications;
create policy audit_question_certifications_insert_admin_scoped
on public.audit_question_certifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.audit_questions q
    join public.audit_sections s on s.id = q.audit_section_id
    join public.audit_templates t on t.id = s.audit_template_id
    where q.id = audit_question_certifications.question_id
      and (t.hotel_id is null or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin']))
  )
  and exists (
    select 1
    from public.certification_standards cs
    join public.audit_questions q on q.id = audit_question_certifications.question_id
    join public.audit_sections s on s.id = q.audit_section_id
    join public.audit_templates t on t.id = s.audit_template_id
    where cs.id = audit_question_certifications.certification_standard_id
      and (t.hotel_id is null or cs.hotel_id = t.hotel_id)
  )
);

drop policy if exists audit_question_certifications_delete_admin_scoped on public.audit_question_certifications;
create policy audit_question_certifications_delete_admin_scoped
on public.audit_question_certifications
for delete
to authenticated
using (
  exists (
    select 1
    from public.audit_questions q
    join public.audit_sections s on s.id = q.audit_section_id
    join public.audit_templates t on t.id = s.audit_template_id
    where q.id = audit_question_certifications.question_id
      and (t.hotel_id is null or public.sc_has_hotel_role(t.hotel_id, array['superadmin', 'admin']))
  )
);

-- ============================================================================
-- RPC: get_audit_run_certification_breakdown
-- Dado un audit_run ya respondido, calcula el % de cumplimiento de forma
-- independiente por cada certificado que tenga al menos una pregunta
-- etiquetada dentro de esa plantilla. Misma fórmula que el score general
-- (submit_audit_run): pass / (total - NA) * 100, ver 20260320170000.
-- ============================================================================
create or replace function public.get_audit_run_certification_breakdown(
  p_run_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run record;
  v_actor record;
  v_breakdown jsonb;
begin
  select id, role, hotel_id, active
    into v_actor
    from public.profiles
   where id = p_actor_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ACTOR_NOT_FOUND', 'message', 'Actor profile not found.');
  end if;

  select id, audit_template_id, hotel_id
    into v_run
    from public.audit_runs
   where id = p_run_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'RUN_NOT_FOUND', 'message', 'Audit run not found.');
  end if;

  if v_actor.role not in ('superadmin') and
     coalesce(v_actor.hotel_id::text, '') != coalesce(v_run.hotel_id::text, '') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'You do not have access to this audit run.');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'certification_standard_id', cs.id,
      'name', cs.name,
      'total_questions', counts.total,
      'na_count', counts.na_count,
      'fail_count', counts.fail_count,
      'pass_count', greatest(0, (counts.total - counts.na_count) - counts.fail_count),
      'score',
        case
          when (counts.total - counts.na_count) > 0 then
            round(
              (greatest(0, (counts.total - counts.na_count) - counts.fail_count)::numeric
                / (counts.total - counts.na_count)::numeric) * 100,
              2
            )
          else null
        end
    ) order by cs.name asc
  ), '[]'::jsonb)
    into v_breakdown
    from public.certification_standards cs
    join lateral (
      select
        count(*)::int as total,
        count(*) filter (where upper(coalesce(a.result, a.answer, '')) = 'NA')::int as na_count,
        count(*) filter (where upper(coalesce(a.result, a.answer, '')) = 'FAIL')::int as fail_count
      from public.audit_question_certifications qc
      join public.audit_questions q on q.id = qc.question_id
      join public.audit_sections s on s.id = q.audit_section_id
      left join public.audit_answers a
        on a.question_id = q.id and a.audit_run_id = p_run_id
      where qc.certification_standard_id = cs.id
        and s.audit_template_id = v_run.audit_template_id
        and q.active = true
    ) counts on true
   where cs.hotel_id = v_run.hotel_id
     and cs.active = true
     and counts.total > 0;

  return jsonb_build_object('ok', true, 'data', v_breakdown);
end;
$$;

grant execute on function public.get_audit_run_certification_breakdown(uuid, uuid) to authenticated;
