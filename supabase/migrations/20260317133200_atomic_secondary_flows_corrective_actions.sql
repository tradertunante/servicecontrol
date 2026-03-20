create or replace function public.update_corrective_action_status_atomic(
  p_action_id uuid,
  p_hotel_id uuid,
  p_actor_user_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action record;
  v_run record;
  v_blocking_open_count integer := 0;
  v_ready_for_reaudit boolean := false;
  v_run_status text := null;
begin
  begin
    if coalesce(p_next_status, '') not in ('open', 'in_progress', 'resolved') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_STATUS', 'message', 'status inválido.');
    end if;

    select
      id,
      hotel_id,
      reaudit_run_id
    into v_action
    from public.audit_corrective_actions
    where id = p_action_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_FOUND', 'message', 'La acción no existe.');
    end if;

    if v_action.hotel_id is distinct from p_hotel_id then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'La acción no pertenece al hotel activo.');
    end if;

    update public.audit_corrective_actions
    set
      status = p_next_status,
      resolved_at = case when p_next_status = 'resolved' then now() else null end,
      resolved_by = case when p_next_status = 'resolved' then p_actor_user_id else null end
    where id = v_action.id;

    if v_action.reaudit_run_id is not null then
      select
        id,
        requires_training,
        training_confirmed
      into v_run
      from public.audit_runs
      where id = v_action.reaudit_run_id
        and hotel_id = p_hotel_id
      for update;

      if found then
        select count(*)::int
        into v_blocking_open_count
        from public.audit_corrective_actions ca
        where ca.reaudit_run_id = v_action.reaudit_run_id
          and ca.hotel_id = p_hotel_id
          and ca.blocks_reaudit = true
          and ca.status <> 'resolved';

        v_ready_for_reaudit :=
          v_blocking_open_count = 0
          and (coalesce(v_run.requires_training, false) = false or coalesce(v_run.training_confirmed, false) = true);

        v_run_status :=
          case
            when v_blocking_open_count > 0 then 'blocked_by_non_operational'
            when coalesce(v_run.requires_training, false) = true and coalesce(v_run.training_confirmed, false) = false then 'pending_training'
            else 'draft'
          end;

        update public.audit_runs
        set
          blocking_issue_count = v_blocking_open_count,
          ready_for_reaudit = v_ready_for_reaudit,
          status = v_run_status
        where id = v_action.reaudit_run_id
          and hotel_id = p_hotel_id;
      end if;
    end if;

    return jsonb_build_object(
      'ok', true,
      'code', 'ACTION_STATUS_UPDATED',
      'data', jsonb_build_object(
        'status', p_next_status,
        'reaudit_run_id', v_action.reaudit_run_id,
        'blocking_issue_count', v_blocking_open_count,
        'ready_for_reaudit', v_ready_for_reaudit,
        'reaudit_status', v_run_status
      )
    );
  exception
    when others then
      return jsonb_build_object('ok', false, 'code', 'INTERNAL_ERROR', 'message', sqlerrm);
  end;
end;
$$;
