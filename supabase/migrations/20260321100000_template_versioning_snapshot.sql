-- Template versioning: snapshot question text into audit_answers
-- so reports always show the text as it was when the audit was created.

-- 1. Add snapshot column
alter table public.audit_answers
  add column if not exists question_text text;

-- 2. Backfill existing answers with current question text
update public.audit_answers a
set question_text = q.text
from public.audit_questions q
where a.question_id = q.id
  and a.question_text is null;

-- 3. Update start_audit_run RPC to snapshot question text when seeding answers
create or replace function public.start_audit_run(
  p_template_id uuid,
  p_area_id uuid,
  p_hotel_id uuid,
  p_executed_by uuid,
  p_audit_channel text default null,
  p_room_number text default null,
  p_assigned_auditor_id uuid default null,
  p_team_member_id uuid default null,
  p_scheduled_for timestamptz default null,
  p_is_reaudit boolean default false,
  p_parent_audit_run_id uuid default null,
  p_origin_type text default null,
  p_requires_training boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_run_id uuid;
  v_run    jsonb;
  v_answers jsonb;
begin
  -- Create the audit run
  insert into public.audit_runs (
    audit_template_id, area_id, hotel_id, executed_by, executed_at,
    status, audit_channel, room_number, assigned_auditor_id, team_member_id,
    scheduled_for, is_reaudit, parent_audit_run_id, origin_type, requires_training
  ) values (
    p_template_id, p_area_id, p_hotel_id, p_executed_by, now(),
    'draft', p_audit_channel, p_room_number, p_assigned_auditor_id, p_team_member_id,
    p_scheduled_for, p_is_reaudit, p_parent_audit_run_id, p_origin_type, p_requires_training
  )
  returning id into v_run_id;

  -- Seed answers with PASS default + snapshot question text
  insert into public.audit_answers (audit_run_id, question_id, answer, result, comment, photo_path, question_text)
  select v_run_id, q.id, 'PASS', 'PASS', null, null, q.text
  from public.audit_sections s
  join public.audit_questions q on q.audit_section_id = s.id
  where s.audit_template_id = p_template_id
    and s.active = true
    and q.active = true;

  -- Return created run
  select to_jsonb(r) into v_run
  from public.audit_runs r
  where r.id = v_run_id;

  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_answers
  from public.audit_answers a
  where a.audit_run_id = v_run_id;

  return jsonb_build_object('run', v_run, 'answers', v_answers);
end;
$$;
