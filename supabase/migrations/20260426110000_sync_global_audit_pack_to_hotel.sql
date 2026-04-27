-- RPC: sync_global_audit_pack_to_hotel
-- Adds only the templates that are in the pack but not yet in the hotel.
-- Idempotent: re-running is safe and never creates duplicates.

create or replace function public.sync_global_audit_pack_to_hotel(
  p_pack_id        uuid,
  p_target_hotel_id uuid
)
returns integer   -- number of templates added
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template      record;
  v_section       record;
  v_new_tpl_id    uuid;
  v_new_sec_id    uuid;
  v_added         integer := 0;
begin
  -- Iterate over global templates in the pack that the hotel doesn't have yet
  for v_template in
    select at.*
    from global_audit_pack_templates gapt
    join audit_templates at on at.id = gapt.audit_template_id
    where gapt.pack_id = p_pack_id
      and not exists (
        select 1
        from audit_templates ht
        where ht.hotel_id          = p_target_hotel_id
          and ht.pack_id           = p_pack_id
          and ht.source_template_id = at.id
      )
  loop
    -- Clone the template record
    v_new_tpl_id := gen_random_uuid();

    insert into audit_templates (
      id, hotel_id, area_id, name, active,
      audit_type, scope, department,
      source_template_id, pack_id,
      require_room_number, require_audited_employee
    ) values (
      v_new_tpl_id,
      p_target_hotel_id,
      null,                        -- area assigned later by admin
      v_template.name,
      v_template.active,
      v_template.audit_type,
      'hotel',
      v_template.department,
      v_template.id,               -- source_template_id → global template
      p_pack_id,
      v_template.require_room_number,
      v_template.require_audited_employee
    );

    -- Clone sections and their questions
    for v_section in
      select * from audit_sections
      where audit_template_id = v_template.id
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
      where audit_section_id = v_section.id;
    end loop;

    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$$;