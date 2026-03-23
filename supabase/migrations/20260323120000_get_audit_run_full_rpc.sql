-- RPC: get_audit_run_full
-- Replaces the 8-query waterfall in useAuditLoader with a single call.
-- Returns the full audit session payload: run + area + template + sections +
-- questions + answers + team members.

create or replace function public.get_audit_run_full(
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
  v_area record;
  v_template record;
  v_actor record;
  v_sections jsonb;
  v_questions jsonb;
  v_answers jsonb;
  v_team_members jsonb;
  v_linked_ids uuid[];
begin
  -- 1. Load the actor profile for permission checks
  select id, role, hotel_id, active
    into v_actor
    from public.profiles
   where id = p_actor_user_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'ACTOR_NOT_FOUND',
      'message', 'Actor profile not found.'
    );
  end if;

  -- 2. Load the audit run
  select id, status, score, notes, room_number, executed_at, executed_by,
         audit_template_id, area_id, team_member_id, assigned_auditor_id,
         is_reaudit, parent_audit_run_id, origin_type, scheduled_for,
         requires_training, training_confirmed, ready_for_reaudit,
         blocking_issue_count, hotel_id
    into v_run
    from public.audit_runs
   where id = p_run_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'RUN_NOT_FOUND',
      'message', 'Audit run not found.'
    );
  end if;

  -- 3. Verify actor belongs to the same hotel
  if v_actor.role not in ('superadmin') and
     coalesce(v_actor.hotel_id::text, '') != coalesce(v_run.hotel_id::text, '') then
    return jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'You do not have access to this audit run.'
    );
  end if;

  -- 4. Load area
  select id, name, type, hotel_id
    into v_area
    from public.areas
   where id = v_run.area_id;

  -- 5. Load template
  select id, name,
         coalesce(require_room_number, false) as require_room_number,
         coalesce(require_audited_employee, false) as require_audited_employee
    into v_template
    from public.audit_templates
   where id = v_run.audit_template_id;

  -- 6. Load sections (active only, ordered)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'active', s.active,
      'created_at', s.created_at
    ) order by s.created_at asc, s.id asc
  ), '[]'::jsonb)
    into v_sections
    from public.audit_sections s
   where s.audit_template_id = v_run.audit_template_id
     and s.active = true;

  -- 7. Load questions (active only, for active sections, ordered)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'audit_section_id', q.audit_section_id,
      'text', q.text,
      'weight', q.weight,
      'photo_requirement', coalesce(q.photo_requirement, 'never'),
      'comment_requirement', coalesce(q.comment_requirement, 'never'),
      'signature_requirement', coalesce(q.signature_requirement, 'never'),
      'active', q.active,
      'order', q.order,
      'created_at', q.created_at,
      'tag', q.tag,
      'classification', q.classification,
      'corrective_flow', coalesce(q.corrective_flow, 'training_only'),
      'responsible_department', q.responsible_department,
      'blocks_reaudit_until_resolved', coalesce(q.blocks_reaudit_until_resolved, false)
    ) order by q.audit_section_id asc, q.order asc, q.created_at asc, q.id asc
  ), '[]'::jsonb)
    into v_questions
    from public.audit_questions q
   where q.audit_section_id in (
           select s.id from public.audit_sections s
            where s.audit_template_id = v_run.audit_template_id
              and s.active = true
         )
     and q.active = true;

  -- 8. Load answers (keyed by question_id for the client)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'audit_run_id', a.audit_run_id,
      'question_id', a.question_id,
      'answer', a.answer,
      'result', a.result,
      'comment', a.comment,
      'photo_path', a.photo_path
    )
  ), '[]'::jsonb)
    into v_answers
    from public.audit_answers a
   where a.audit_run_id = p_run_id;

  -- 9. Load team members linked to the area
  select array_agg(distinct tma.team_member_id)
    into v_linked_ids
    from public.team_member_areas tma
   where tma.area_id = v_run.area_id;

  -- Get active team members from linked IDs + possibly out-of-area current member
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tm.id,
      'full_name', tm.full_name,
      '_outOfArea', case
        when tm.id = any(coalesce(v_linked_ids, array[]::uuid[])) then false
        else true
      end
    ) order by tm.full_name asc
  ), '[]'::jsonb)
    into v_team_members
    from public.team_members tm
   where tm.active = true
     and (
       tm.id = any(coalesce(v_linked_ids, array[]::uuid[]))
       or tm.id = v_run.team_member_id
     );

  -- Return the full payload
  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'run', jsonb_build_object(
        'id', v_run.id,
        'status', v_run.status,
        'score', v_run.score,
        'notes', v_run.notes,
        'room_number', v_run.room_number,
        'executed_at', v_run.executed_at,
        'executed_by', v_run.executed_by,
        'audit_template_id', v_run.audit_template_id,
        'area_id', v_run.area_id,
        'team_member_id', v_run.team_member_id,
        'assigned_auditor_id', v_run.assigned_auditor_id,
        'is_reaudit', v_run.is_reaudit,
        'parent_audit_run_id', v_run.parent_audit_run_id,
        'origin_type', v_run.origin_type,
        'scheduled_for', v_run.scheduled_for,
        'requires_training', v_run.requires_training,
        'training_confirmed', v_run.training_confirmed,
        'ready_for_reaudit', v_run.ready_for_reaudit,
        'blocking_issue_count', v_run.blocking_issue_count
      ),
      'area', jsonb_build_object(
        'id', v_area.id,
        'name', v_area.name,
        'type', v_area.type,
        'hotel_id', v_area.hotel_id
      ),
      'template', jsonb_build_object(
        'id', v_template.id,
        'name', v_template.name,
        'require_room_number', v_template.require_room_number,
        'require_audited_employee', v_template.require_audited_employee
      ),
      'sections', v_sections,
      'questions', v_questions,
      'answers', v_answers,
      'teamMembers', v_team_members
    )
  );
end;
$$;
