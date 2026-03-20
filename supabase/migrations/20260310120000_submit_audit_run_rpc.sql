create or replace function public.submit_audit_run(
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
  v_template record;
  v_actor record;
  v_rules record;
  v_existing_reaudit record;
  v_created_reaudit record;
  v_q record;
  v_a record;
  v_answer_value text;
  v_answer_count integer := 0;
  v_updated_count integer := 0;

  v_total_questions integer := 0;
  v_fail_count integer := 0;
  v_na_count integer := 0;
  v_pass_count integer := 0;
  v_denominator integer := 0;
  v_score numeric(5,2) := null;

  v_requires_training boolean := false;
  v_blocking_count integer := 0;
  v_created_corrective_actions integer := 0;

  v_should_create_reaudit boolean := false;
  v_reaudit_created boolean := false;
  v_reaudit_run_id uuid := null;
  v_reaudit_status text := null;
  v_reaudit_assigned_auditor_id uuid := null;
  v_reaudit_notes text := null;

  v_has_training_fail boolean := false;

  v_meta jsonb;
begin
  v_meta := jsonb_build_object(
    'run_id', p_run_id,
    'actor_user_id', p_actor_user_id,
    'idempotent', false,
    'submitted', false
  );

  begin
    select
      id,
      hotel_id,
      area_id,
      audit_template_id,
      status,
      score,
      notes,
      executed_at,
      executed_by,
      team_member_id,
      assigned_auditor_id,
      is_reaudit,
      parent_audit_run_id,
      origin_type,
      scheduled_for,
      requires_training,
      training_confirmed,
      ready_for_reaudit,
      blocking_issue_count
    into v_run
    from public.audit_runs
    where id = p_run_id
    for update;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'RUN_NOT_FOUND',
        'message', 'Audit run not found.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'not_found',
          'field', 'run_id',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if v_run.status = 'submitted' then
      select
        count(*)::int as total_questions,
        count(*) filter (where upper(coalesce(a.result, a.answer, '')) = 'FAIL')::int as fail_count,
        count(*) filter (where upper(coalesce(a.result, a.answer, '')) = 'NA')::int as na_count
      into v_total_questions, v_fail_count, v_na_count
      from public.audit_questions q
      join public.audit_sections s
        on s.id = q.audit_section_id
      left join public.audit_answers a
        on a.question_id = q.id
       and a.audit_run_id = v_run.id
      where s.audit_template_id = v_run.audit_template_id
        and s.active = true
        and q.active = true;

      v_denominator := greatest(0, v_total_questions - v_na_count);
      v_pass_count := greatest(0, v_denominator - v_fail_count);

      select count(*)::int
      into v_blocking_count
      from public.audit_corrective_actions ca
      where ca.audit_run_id = v_run.id
        and ca.blocks_reaudit = true
        and ca.status <> 'resolved';

      select count(*)::int
      into v_created_corrective_actions
      from public.audit_corrective_actions ca
      where ca.audit_run_id = v_run.id;

      select
        id,
        status
      into v_existing_reaudit
      from public.audit_runs
      where parent_audit_run_id = v_run.id
        and is_reaudit = true
        and origin_type = 'auto_below_threshold'
      order by scheduled_for asc nulls last, id asc
      limit 1;

      return jsonb_build_object(
        'ok', true,
        'code', 'AUDIT_ALREADY_SUBMITTED',
        'message', 'Audit was already submitted.',
        'data', jsonb_build_object(
          'run', jsonb_build_object(
            'id', v_run.id,
            'status', v_run.status,
            'score', v_run.score,
            'is_reaudit', coalesce(v_run.is_reaudit, false)
          ),
          'summary', jsonb_build_object(
            'total_questions', v_total_questions,
            'pass_count', v_pass_count,
            'fail_count', v_fail_count,
            'na_count', v_na_count,
            'denominator', v_denominator
          ),
          'corrective_actions', jsonb_build_object(
            'created_count', 0,
            'blocking_count', v_blocking_count
          ),
          'reaudit', jsonb_build_object(
            'created', false,
            'run_id', v_existing_reaudit.id
          )
        ),
        'error', null,
        'meta', jsonb_build_object(
          'run_id', p_run_id,
          'actor_user_id', p_actor_user_id,
          'idempotent', true,
          'submitted', true
        )
      );
    end if;

    if v_run.status is distinct from 'draft' then
      return jsonb_build_object(
        'ok', false,
        'code', 'RUN_INVALID_STATUS',
        'message', 'Audit run is not in a submittable state.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'invalid_state',
          'field', 'status',
          'question_id', null,
          'details', jsonb_build_object(
            'current_status', v_run.status
          )
        ),
        'meta', v_meta
      );
    end if;

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
        'message', 'Actor profile not found.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'not_found',
          'field', 'actor_user_id',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if coalesce(v_actor.active, true) = false then
      return jsonb_build_object(
        'ok', false,
        'code', 'ACTOR_INACTIVE',
        'message', 'Actor profile is inactive.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'forbidden',
          'field', 'active',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if coalesce(v_actor.role, '') not in ('superadmin', 'admin', 'auditor', 'quality') then
      return jsonb_build_object(
        'ok', false,
        'code', 'FORBIDDEN_ROLE',
        'message', 'Actor role is not allowed to submit audits.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'forbidden',
          'field', 'role',
          'question_id', null,
          'details', jsonb_build_object(
            'role', v_actor.role
          )
        ),
        'meta', v_meta
      );
    end if;

    if v_run.hotel_id is null or v_run.area_id is null or v_run.audit_template_id is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'INTERNAL_ERROR',
        'message', 'Audit run is missing required relational fields.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'internal',
          'field', null,
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if v_actor.role <> 'superadmin' and v_actor.hotel_id is distinct from v_run.hotel_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'FORBIDDEN_HOTEL',
        'message', 'Actor does not belong to the same hotel as the audit run.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'forbidden',
          'field', 'hotel_id',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if v_actor.role = 'auditor'
      and v_run.executed_by is distinct from p_actor_user_id
      and v_run.assigned_auditor_id is distinct from p_actor_user_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'FORBIDDEN_RUN_ACCESS',
        'message', 'The actor is not allowed to submit this audit run.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'forbidden',
          'field', null,
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    select
      id,
      require_room_number,
      require_audited_employee
    into v_template
    from public.audit_templates
    where id = v_run.audit_template_id;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'TEMPLATE_NOT_FOUND',
        'message', 'Audit template not found.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'not_found',
          'field', 'audit_template_id',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if coalesce(v_template.require_room_number, false) = true
      and nullif(btrim(coalesce(v_run.room_number, '')), '') is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'ROOM_NUMBER_REQUIRED',
        'message', 'Debes capturar el número de habitación antes de enviar esta auditoría.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'validation',
          'field', 'room_number',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if coalesce(v_template.require_audited_employee, false) = true
      and v_run.team_member_id is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'AUDITED_EMPLOYEE_REQUIRED',
        'message', 'Debes seleccionar el colaborador auditado antes de enviar esta auditoría.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'validation',
          'field', 'team_member_id',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    if not exists (
      select 1
      from public.audit_questions q
      join public.audit_sections s
        on s.id = q.audit_section_id
      where s.audit_template_id = v_run.audit_template_id
        and s.active = true
        and q.active = true
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'NO_ACTIVE_QUESTIONS',
        'message', 'No active questions were found for the audit template.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'validation',
          'field', null,
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    -- Step 1 intentionally validates against the current live active question set
    -- of the template, matching the current frontend behavior.
    for v_q in
      select
        q.id,
        q.text,
        q.comment_requirement,
        q.photo_requirement,
        q.corrective_flow,
        q.responsible_department,
        q.blocks_reaudit_until_resolved
      from public.audit_questions q
      join public.audit_sections s
        on s.id = q.audit_section_id
      where s.audit_template_id = v_run.audit_template_id
        and s.active = true
        and q.active = true
      order by q.audit_section_id asc, q."order" asc nulls last, q.created_at asc nulls last, q.id asc
    loop
      v_total_questions := v_total_questions + 1;

      select count(*)::int
      into v_answer_count
      from public.audit_answers
      where audit_run_id = v_run.id
        and question_id = v_q.id;

      if v_answer_count = 0 then
        return jsonb_build_object(
          'ok', false,
          'code', 'MISSING_ANSWER',
          'message', 'An active question does not have an answer.',
          'data', null,
          'error', jsonb_build_object(
            'type', 'validation',
            'field', 'answer',
            'question_id', v_q.id,
            'details', jsonb_build_object()
          ),
          'meta', v_meta
        );
      end if;

      if v_answer_count > 1 then
        return jsonb_build_object(
          'ok', false,
          'code', 'INTERNAL_ERROR',
          'message', 'Duplicate answers found for a question in this audit run.',
          'data', null,
          'error', jsonb_build_object(
            'type', 'internal',
            'field', 'audit_answers',
            'question_id', v_q.id,
            'details', jsonb_build_object()
          ),
          'meta', v_meta
        );
      end if;

      select
        id,
        question_id,
        answer,
        result,
        comment,
        photo_path
      into v_a
      from public.audit_answers
      where audit_run_id = v_run.id
        and question_id = v_q.id;

      v_answer_value := upper(coalesce(v_a.result, v_a.answer, ''));

      if v_answer_value not in ('PASS', 'FAIL', 'NA') then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_ANSWER_VALUE',
          'message', 'An answer contains an invalid value.',
          'data', null,
          'error', jsonb_build_object(
            'type', 'validation',
            'field', 'answer',
            'question_id', v_q.id,
            'details', jsonb_build_object(
              'value', coalesce(v_a.result, v_a.answer)
            )
          ),
          'meta', v_meta
        );
      end if;

      if v_q.comment_requirement = 'always'
         or (v_q.comment_requirement = 'if_fail' and v_answer_value = 'FAIL') then
        if nullif(btrim(coalesce(v_a.comment, '')), '') is null then
          return jsonb_build_object(
            'ok', false,
            'code', 'MISSING_REQUIRED_COMMENT',
            'message', 'A required comment is missing.',
            'data', null,
            'error', jsonb_build_object(
              'type', 'validation',
              'field', 'comment',
              'question_id', v_q.id,
              'details', jsonb_build_object(
                'requirement', v_q.comment_requirement
              )
            ),
            'meta', v_meta
          );
        end if;
      end if;

      if v_q.photo_requirement = 'always'
         or (v_q.photo_requirement = 'if_fail' and v_answer_value = 'FAIL') then
        if nullif(btrim(coalesce(v_a.photo_path, '')), '') is null then
          return jsonb_build_object(
            'ok', false,
            'code', 'MISSING_REQUIRED_PHOTO',
            'message', 'A required photo is missing.',
            'data', null,
            'error', jsonb_build_object(
              'type', 'validation',
              'field', 'photo_path',
              'question_id', v_q.id,
              'details', jsonb_build_object(
                'requirement', v_q.photo_requirement
              )
            ),
            'meta', v_meta
          );
        end if;
      end if;

      if v_answer_value = 'FAIL' then
        v_fail_count := v_fail_count + 1;
      elsif v_answer_value = 'NA' then
        v_na_count := v_na_count + 1;
      end if;

      if v_answer_value = 'FAIL'
         and coalesce(v_q.corrective_flow, 'training_only') in ('training_only', 'mixed') then
        v_has_training_fail := true;
      end if;

      if v_answer_value = 'FAIL'
         and coalesce(v_q.blocks_reaudit_until_resolved, false) = true
         and coalesce(v_q.corrective_flow, 'training_only') in ('non_operational', 'mixed')
         and coalesce(v_q.responsible_department, '') in ('engineering', 'systems') then
        v_blocking_count := v_blocking_count + 1;
      end if;
    end loop;

    v_denominator := greatest(0, v_total_questions - v_na_count);
    v_pass_count := greatest(0, v_denominator - v_fail_count);

    if v_denominator > 0 then
      v_score := round((v_pass_count::numeric / v_denominator::numeric) * 100, 2);
    else
      v_score := null;
    end if;

    select
      hotel_id,
      auto_reaudit_enabled,
      auto_reaudit_threshold,
      auto_reaudit_delay_days,
      require_training_before_reaudit
    into v_rules
    from public.hotel_audit_rules
    where hotel_id = v_run.hotel_id
    limit 1;

    v_requires_training := coalesce(v_rules.require_training_before_reaudit, false) and v_has_training_fail;

    v_should_create_reaudit :=
      v_rules.hotel_id is not null
      and coalesce(v_rules.auto_reaudit_enabled, false) = true
      and v_score is not null
      and v_score < coalesce(v_rules.auto_reaudit_threshold, 0)
      and coalesce(v_run.is_reaudit, false) = false;

    if v_should_create_reaudit then
      select
        id,
        status
      into v_existing_reaudit
      from public.audit_runs
      where parent_audit_run_id = v_run.id
        and is_reaudit = true
        and origin_type = 'auto_below_threshold'
      order by scheduled_for asc nulls last, id asc
      limit 1;

      if found then
        v_reaudit_run_id := v_existing_reaudit.id;
      else
        v_reaudit_assigned_auditor_id := coalesce(v_run.assigned_auditor_id, v_run.executed_by);
        v_reaudit_status :=
          case
            when v_blocking_count > 0 then 'blocked_by_non_operational'
            when v_requires_training then 'pending_training'
            else 'draft'
          end;

        v_reaudit_notes :=
          case
            when v_score is null then 'Re-auditoría automática'
            else 'Re-auditoría automática por score ' || trim(to_char(v_score, 'FM999999990.00')) || '%'
          end;

        insert into public.audit_runs (
          hotel_id,
          area_id,
          audit_template_id,
          team_member_id,
          assigned_auditor_id,
          executed_by,
          status,
          score,
          is_reaudit,
          parent_audit_run_id,
          origin_type,
          scheduled_for,
          requires_training,
          training_confirmed,
          ready_for_reaudit,
          blocking_issue_count,
          notes
        )
        values (
          v_run.hotel_id,
          v_run.area_id,
          v_run.audit_template_id,
          v_run.team_member_id,
          v_reaudit_assigned_auditor_id,
          v_reaudit_assigned_auditor_id,
          v_reaudit_status,
          null,
          true,
          v_run.id,
          'auto_below_threshold',
          now() + make_interval(days => coalesce(v_rules.auto_reaudit_delay_days, 0)),
          v_requires_training,
          false,
          (v_blocking_count = 0 and v_requires_training = false),
          v_blocking_count,
          v_reaudit_notes
        )
        returning id, status
        into v_created_reaudit;

        v_reaudit_run_id := v_created_reaudit.id;
        v_reaudit_created := true;
      end if;
    end if;

    for v_q in
      select
        q.id,
        q.text,
        q.corrective_flow,
        q.responsible_department,
        q.blocks_reaudit_until_resolved,
        a.comment,
        a.photo_path,
        upper(coalesce(a.result, a.answer, '')) as answer_value
      from public.audit_questions q
      join public.audit_sections s
        on s.id = q.audit_section_id
      join public.audit_answers a
        on a.question_id = q.id
       and a.audit_run_id = v_run.id
      where s.audit_template_id = v_run.audit_template_id
        and s.active = true
        and q.active = true
      order by q.id asc
    loop
      if v_q.answer_value <> 'FAIL' then
        continue;
      end if;

      if coalesce(v_q.corrective_flow, 'training_only') not in ('non_operational', 'mixed') then
        continue;
      end if;

      if coalesce(v_q.responsible_department, '') not in ('engineering', 'systems') then
        continue;
      end if;

      if exists (
        select 1
        from public.audit_corrective_actions ca
        where ca.audit_run_id = v_run.id
          and ca.question_id = v_q.id
      ) then
        continue;
      end if;

      insert into public.audit_corrective_actions (
        hotel_id,
        area_id,
        audit_run_id,
        reaudit_run_id,
        question_id,
        team_member_id,
        assigned_department,
        status,
        title,
        description,
        evidence_note,
        evidence_photo_path,
        blocks_reaudit
      )
      values (
        v_run.hotel_id,
        v_run.area_id,
        v_run.id,
        v_reaudit_run_id,
        v_q.id,
        v_run.team_member_id,
        v_q.responsible_department,
        'open',
        v_q.text,
        nullif(btrim(coalesce(v_q.comment, '')), ''),
        nullif(btrim(coalesce(v_q.comment, '')), ''),
        v_q.photo_path,
        coalesce(v_q.blocks_reaudit_until_resolved, false)
      );

      v_created_corrective_actions := v_created_corrective_actions + 1;
    end loop;

    update public.audit_runs
    set
      status = 'submitted',
      score = v_score
    where id = v_run.id;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      return jsonb_build_object(
        'ok', false,
        'code', 'INTERNAL_ERROR',
        'message', 'Failed to update audit run.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'internal',
          'field', 'audit_runs',
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'code', 'AUDIT_SUBMITTED',
      'message', 'Audit submitted successfully.',
      'data', jsonb_build_object(
        'run', jsonb_build_object(
          'id', v_run.id,
          'status', 'submitted',
          'score', v_score,
          'is_reaudit', coalesce(v_run.is_reaudit, false)
        ),
        'summary', jsonb_build_object(
          'total_questions', v_total_questions,
          'pass_count', v_pass_count,
          'fail_count', v_fail_count,
          'na_count', v_na_count,
          'denominator', v_denominator
        ),
        'corrective_actions', jsonb_build_object(
          'created_count', v_created_corrective_actions,
          'blocking_count', v_blocking_count
        ),
        'reaudit', jsonb_build_object(
          'created', v_reaudit_created,
          'run_id', v_reaudit_run_id
        )
      ),
      'error', null,
      'meta', jsonb_build_object(
        'run_id', p_run_id,
        'actor_user_id', p_actor_user_id,
        'idempotent', false,
        'submitted', true
      )
    );

  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'code', 'INTERNAL_ERROR',
        'message', 'Unexpected error while submitting audit.',
        'data', null,
        'error', jsonb_build_object(
          'type', 'internal',
          'field', null,
          'question_id', null,
          'details', jsonb_build_object()
        ),
        'meta', v_meta
      );
  end;
end;
$$;

revoke all on function public.submit_audit_run(uuid, uuid) from public;
revoke all on function public.submit_audit_run(uuid, uuid) from anon;
revoke all on function public.submit_audit_run(uuid, uuid) from authenticated;
