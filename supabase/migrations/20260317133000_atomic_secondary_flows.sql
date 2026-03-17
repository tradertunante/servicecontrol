create or replace function public.start_append_note(
  p_existing text,
  p_block text
)
returns text
language sql
immutable
as $$
  select
    case
      when nullif(btrim(coalesce(p_block, '')), '') is null then p_existing
      when nullif(btrim(coalesce(p_existing, '')), '') is null then nullif(btrim(coalesce(p_block, '')), '')
      else p_existing || E'\n\n' || nullif(btrim(coalesce(p_block, '')), '')
    end
$$;

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

create or replace function public.set_user_area_access_atomic(
  p_user_id uuid,
  p_hotel_id uuid,
  p_area_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_distinct_area_ids uuid[] := array[]::uuid[];
  v_valid_count integer := 0;
begin
  begin
    if p_user_id is null or p_hotel_id is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'user_id y hotel_id son obligatorios.');
    end if;

    select coalesce(array_agg(distinct area_id), array[]::uuid[])
    into v_distinct_area_ids
    from unnest(coalesce(p_area_ids, array[]::uuid[])) as area_id;

    if coalesce(array_length(v_distinct_area_ids, 1), 0) > 0 then
      select count(*)::int
      into v_valid_count
      from public.areas
      where hotel_id = p_hotel_id
        and id = any(v_distinct_area_ids);

      if v_valid_count <> coalesce(array_length(v_distinct_area_ids, 1), 0) then
        return jsonb_build_object('ok', false, 'code', 'INVALID_AREAS', 'message', 'Hay áreas que no pertenecen al hotel seleccionado.');
      end if;
    end if;

    delete from public.user_area_access
    where hotel_id = p_hotel_id
      and user_id = p_user_id;

    if coalesce(array_length(v_distinct_area_ids, 1), 0) > 0 then
      insert into public.user_area_access (user_id, area_id, hotel_id)
      select p_user_id, area_id, p_hotel_id
      from unnest(v_distinct_area_ids) as area_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'code', 'AREA_ACCESS_UPDATED',
      'data', jsonb_build_object(
        'count', coalesce(array_length(v_distinct_area_ids, 1), 0)
      )
    );
  exception
    when others then
      return jsonb_build_object('ok', false, 'code', 'INTERNAL_ERROR', 'message', sqlerrm);
  end;
end;
$$;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_full_name text;
  v_role text;
  v_hotel_id uuid;
  v_active boolean;
begin
  v_full_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_role := lower(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'role', '')), ''));
  v_active := coalesce((new.raw_user_meta_data ->> 'active')::boolean, true);

  if nullif(coalesce(new.raw_user_meta_data ->> 'hotel_id', ''), '') is not null then
    v_hotel_id := (new.raw_user_meta_data ->> 'hotel_id')::uuid;
  else
    v_hotel_id := null;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    hotel_id,
    active
  )
  values (
    new.id,
    new.email,
    v_full_name,
    case
      when v_role in ('superadmin', 'admin', 'general_manager', 'manager', 'auditor', 'quality', 'engineering', 'it', 'systems')
        then v_role
      else 'auditor'
    end,
    v_hotel_id,
    v_active
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    hotel_id = excluded.hotel_id,
    active = excluded.active;

  return new;
end;
$$;

create or replace function public.cleanup_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.user_area_access where user_id = old.id;
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_sync_profile_from_auth_user on auth.users;
create trigger trg_sync_profile_from_auth_user
after insert on auth.users
for each row
execute function public.sync_profile_from_auth_user();

drop trigger if exists trg_cleanup_profile_from_auth_user on auth.users;
create trigger trg_cleanup_profile_from_auth_user
after delete on auth.users
for each row
execute function public.cleanup_profile_from_auth_user();

revoke all on function public.process_reaudit_action(text, uuid, uuid, uuid, text, text, uuid) from public;
revoke all on function public.process_reaudit_action(text, uuid, uuid, uuid, text, text, uuid) from anon;
revoke all on function public.process_reaudit_action(text, uuid, uuid, uuid, text, text, uuid) from authenticated;

revoke all on function public.update_corrective_action_status_atomic(uuid, uuid, uuid, text) from public;
revoke all on function public.update_corrective_action_status_atomic(uuid, uuid, uuid, text) from anon;
revoke all on function public.update_corrective_action_status_atomic(uuid, uuid, uuid, text) from authenticated;

revoke all on function public.set_user_area_access_atomic(uuid, uuid, uuid[]) from public;
revoke all on function public.set_user_area_access_atomic(uuid, uuid, uuid[]) from anon;
revoke all on function public.set_user_area_access_atomic(uuid, uuid, uuid[]) from authenticated;
