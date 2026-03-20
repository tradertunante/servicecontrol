create or replace function public.process_reaudit_action(
  p_action text,
  p_hotel_id uuid,
  p_run_id uuid,
  p_actor_user_id uuid,
  p_note_block text default null,
  p_explanation text default null,
  p_next_auditor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run record;
  v_actor record;
  v_next_auditor record;
  v_has_area_access boolean := false;
  v_next_ready boolean := false;
  v_next_status text := null;
begin
  begin
    if coalesce(p_action, '') not in ('confirm_training', 'reassign_auditor') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_ACTION', 'message', 'action inválida.');
    end if;

    select id, role, active
    into v_actor
    from public.profiles
    where id = p_actor_user_id;

    if not found or coalesce(v_actor.active, true) = false then
      return jsonb_build_object('ok', false, 'code', 'ACTOR_INVALID', 'message', 'Actor inválido o inactivo.');
    end if;

    select
      id,
      hotel_id,
      area_id,
      team_member_id,
      assigned_auditor_id,
      status,
      notes,
      blocking_issue_count,
      is_reaudit
    into v_run
    from public.audit_runs
    where id = p_run_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'RUN_NOT_FOUND', 'message', 'La re-auditoría no existe.');
    end if;

    if v_run.hotel_id is distinct from p_hotel_id then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'La re-auditoría no pertenece al hotel activo.');
    end if;

    if coalesce(v_run.is_reaudit, false) = false then
      return jsonb_build_object('ok', false, 'code', 'NOT_REAUDIT', 'message', 'El run indicado no es una re-auditoría.');
    end if;

    if p_action = 'confirm_training' then
      if nullif(btrim(coalesce(p_explanation, '')), '') is null then
        return jsonb_build_object('ok', false, 'code', 'MISSING_EXPLANATION', 'message', 'Debes explicar qué formación o medida correctiva se realizó antes de confirmar el training.');
      end if;

      if length(btrim(p_explanation)) < 12 then
        return jsonb_build_object('ok', false, 'code', 'EXPLANATION_TOO_SHORT', 'message', 'La explicación es demasiado corta. Añade suficiente detalle para futura trazabilidad.');
      end if;

      v_next_ready := coalesce(v_run.blocking_issue_count, 0) = 0;
      v_next_status := case when v_next_ready then 'draft' else 'blocked_by_non_operational' end;

      update public.audit_runs
      set
        training_confirmed = true,
        blocking_issue_count = coalesce(v_run.blocking_issue_count, 0),
        ready_for_reaudit = v_next_ready,
        status = v_next_status,
        notes = public.start_append_note(notes, p_note_block)
      where id = v_run.id;

      insert into public.reaudit_training_logs (
        hotel_id,
        reaudit_run_id,
        team_member_id,
        confirmed_by,
        confirmed_at,
        explanation
      )
      values (
        p_hotel_id,
        v_run.id,
        v_run.team_member_id,
        p_actor_user_id,
        now(),
        nullif(btrim(coalesce(p_explanation, '')), '')
      );

      return jsonb_build_object(
        'ok', true,
        'code', 'TRAINING_CONFIRMED',
        'data', jsonb_build_object(
          'status', v_next_status,
          'ready_for_reaudit', v_next_ready
        )
      );
    end if;

    if p_next_auditor_id is null then
      return jsonb_build_object('ok', false, 'code', 'MISSING_AUDITOR', 'message', 'Debes seleccionar un auditor para reasignar la re-auditoría.');
    end if;

    if p_next_auditor_id = v_run.assigned_auditor_id then
      return jsonb_build_object('ok', false, 'code', 'SAME_AUDITOR', 'message', 'Selecciona un auditor diferente al actual.');
    end if;

    if coalesce(v_run.status, '') = 'submitted' then
      return jsonb_build_object('ok', false, 'code', 'RUN_ALREADY_SUBMITTED', 'message', 'No se puede reasignar una re-auditoría ya cerrada.');
    end if;

    select id, full_name, hotel_id, active
    into v_next_auditor
    from public.profiles
    where id = p_next_auditor_id;

    if not found or coalesce(v_next_auditor.active, true) = false or v_next_auditor.hotel_id is distinct from p_hotel_id then
      return jsonb_build_object('ok', false, 'code', 'AUDITOR_OUT_OF_SCOPE', 'message', 'El auditor seleccionado no pertenece al hotel activo.');
    end if;

    select exists(
      select 1
      from public.user_area_access uaa
      where uaa.hotel_id = p_hotel_id
        and uaa.area_id = v_run.area_id
        and uaa.user_id = p_next_auditor_id
    )
    into v_has_area_access;

    if not v_has_area_access then
      return jsonb_build_object('ok', false, 'code', 'AUDITOR_NO_AREA_ACCESS', 'message', 'El auditor seleccionado no tiene acceso al área de esta re-auditoría.');
    end if;

    update public.audit_runs
    set
      assigned_auditor_id = p_next_auditor_id,
      notes = public.start_append_note(notes, p_note_block)
    where id = v_run.id;

    insert into public.reaudit_assignment_logs (
      hotel_id,
      reaudit_run_id,
      previous_auditor_id,
      new_auditor_id,
      changed_by,
      changed_at,
      reason,
      note
    )
    values (
      p_hotel_id,
      v_run.id,
      v_run.assigned_auditor_id,
      p_next_auditor_id,
      p_actor_user_id,
      now(),
      nullif(btrim(coalesce(p_explanation, '')), ''),
      nullif(btrim(coalesce(p_explanation, '')), '')
    );

    return jsonb_build_object(
      'ok', true,
      'code', 'AUDITOR_REASSIGNED',
      'data', jsonb_build_object(
        'assigned_auditor_id', p_next_auditor_id
      )
    );
  exception
    when others then
      return jsonb_build_object('ok', false, 'code', 'INTERNAL_ERROR', 'message', sqlerrm);
  end;
end;
$$;
