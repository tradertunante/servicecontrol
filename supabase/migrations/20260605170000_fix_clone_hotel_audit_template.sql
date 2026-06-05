-- Fix clone_hotel_audit_template: previous version did not copy sections or questions.
-- Now correctly clones the full template hierarchy: template → sections → questions.

create or replace function public.clone_hotel_audit_template(
  p_template_id    uuid,
  p_target_hotel_id uuid,
  p_new_name       text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src           record;
  v_section       record;
  v_new_tpl_id    uuid;
  v_new_sec_id    uuid;
begin
  -- Read source template (must belong to the target hotel)
  select * into v_src
  from audit_templates
  where id = p_template_id
    and hotel_id = p_target_hotel_id;

  if not found then
    raise exception 'Template % not found in hotel %', p_template_id, p_target_hotel_id;
  end if;

  v_new_tpl_id := gen_random_uuid();

  -- Clone the template record (keep same area, pack, etc.)
  insert into audit_templates (
    id, hotel_id, area_id, name, active,
    audit_type, scope, department,
    source_template_id, pack_id, base_template_id, standard_id,
    require_room_number, require_audited_employee, is_global
  ) values (
    v_new_tpl_id,
    p_target_hotel_id,
    v_src.area_id,
    p_new_name,
    v_src.active,
    v_src.audit_type,
    v_src.scope,
    v_src.department,
    v_src.source_template_id,
    v_src.pack_id,
    v_src.base_template_id,
    v_src.standard_id,
    v_src.require_room_number,
    v_src.require_audited_employee,
    false
  );

  -- Clone sections and their questions
  for v_section in
    select * from audit_sections
    where audit_template_id = p_template_id
    order by "order"
  loop
    v_new_sec_id := gen_random_uuid();

    insert into audit_sections (id, audit_template_id, name, "order", active)
    values (v_new_sec_id, v_new_tpl_id, v_section.name, v_section.order, v_section.active);

    insert into audit_questions (
      id, audit_section_id, text, weight,
      require_photo, require_comment, require_signature,
      active, "order", tag, classification,
      photo_requirement, comment_requirement, signature_requirement,
      corrective_flow, responsible_department,
      blocks_reaudit_until_resolved, owner_department
    )
    select
      gen_random_uuid(), v_new_sec_id, text, weight,
      require_photo, require_comment, require_signature,
      active, "order", tag, classification,
      photo_requirement, comment_requirement, signature_requirement,
      corrective_flow, responsible_department,
      blocks_reaudit_until_resolved, owner_department
    from audit_questions
    where audit_section_id = v_section.id
    order by "order";
  end loop;

  return v_new_tpl_id;
end;
$$;