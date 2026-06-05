-- Allow mystery_shopper role to call start_audit_run.
-- Only change vs previous version: mystery_shopper added to the role allowlist on line 47.

create or replace function public.start_audit_run(
  p_hotel_id uuid,
  p_area_id uuid,
  p_template_id uuid,
  p_actor_user_id uuid,
  p_room_number text default null,
  p_audit_channel text default 'internal'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_area record;
  v_template record;
  v_run_id uuid;
  v_seeded_count integer := 0;
begin
  begin
    select
      id,
      role,
      hotel_id,
      active
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

    if coalesce(v_actor.active, true) = false then
      return jsonb_build_object(
        'ok', false,
        'code', 'ACTOR_INACTIVE',
        'message', 'Actor profile is inactive.'
      );
    end if;

    if coalesce(v_actor.role, '') not in (
      'superadmin', 'admin', 'general_manager', 'manager', 'auditor', 'quality', 'mystery_shopper'
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'FORBIDDEN_ROLE',
        'message', 'Actor role is not allowed to start audits.'
      );
    end if;

    if coalesce(p_audit_channel, '') not in ('internal', 'quality') then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_AUDIT_CHANNEL',
        'message', 'Invalid audit channel.'
      );
    end if;

    select
      id,
      hotel_id,
      active
    into v_area
    from public.areas
    where id = p_area_id;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'AREA_NOT_FOUND',
        'message', 'Area not found.'
      );
    end if;

    if v_area.hotel_id is distinct from p_hotel_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'AREA_OUT_OF_SCOPE',
        'message', 'Area does not belong to the active hotel.'
      );
    end if;

    if coalesce(v_area.active, true) = false then
      return jsonb_build_object(
        'ok', false,
        'code', 'AREA_INACTIVE',
        'message', 'Area is inactive.'
      );
    end if;

    select
      id,
      hotel_id,
      area_id,
      active
    into v_template
    from public.audit_templates
    where id = p_template_id;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'TEMPLATE_NOT_FOUND',
        'message', 'Audit template not found.'
      );
    end if;

    if v_template.hotel_id is distinct from p_hotel_id or v_template.area_id is distinct from p_area_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'TEMPLATE_OUT_OF_SCOPE',
        'message', 'Audit template does not belong to the active hotel or area.'
      );
    end if;

    if coalesce(v_template.active, true) = false then
      return jsonb_build_object(
        'ok', false,
        'code', 'TEMPLATE_INACTIVE',
        'message', 'Audit template is inactive.'
      );
    end if;

    insert into public.audit_runs (
      hotel_id,
      area_id,
      audit_template_id,
      status,
      score,
      notes,
      room_number,
      executed_at,
      executed_by,
      audit_channel
    )
    values (
      p_hotel_id,
      p_area_id,
      p_template_id,
      'draft',
      null,
      null,
      nullif(btrim(coalesce(p_room_number, '')), ''),
      now(),
      p_actor_user_id,
      p_audit_channel
    )
    returning id
    into v_run_id;

    insert into public.audit_answers (
      audit_run_id,
      question_id,
      answer,
      result,
      comment,
      photo_path
    )
    select
      v_run_id,
      q.id,
      'PASS',
      'PASS',
      null,
      null
    from public.audit_sections s
    join public.audit_questions q
      on q.audit_section_id = s.id
    where s.audit_template_id = p_template_id
      and s.active = true
      and q.active = true;

    get diagnostics v_seeded_count = row_count;

    return jsonb_build_object(
      'ok', true,
      'code', 'AUDIT_STARTED',
      'message', 'Audit started successfully.',
      'data', jsonb_build_object(
        'run_id', v_run_id,
        'seeded_answers', v_seeded_count
      )
    );
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'code', 'INTERNAL_ERROR',
        'message', sqlerrm
      );
  end;
end;
$$;

revoke all on function public.start_audit_run(uuid, uuid, uuid, uuid, text, text) from public;
revoke all on function public.start_audit_run(uuid, uuid, uuid, uuid, text, text) from anon;
revoke all on function public.start_audit_run(uuid, uuid, uuid, uuid, text, text) from authenticated;