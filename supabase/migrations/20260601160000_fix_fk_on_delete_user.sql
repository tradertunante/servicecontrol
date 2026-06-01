-- Allow deleting profiles/users that have associated audit records.
-- Changes blocking FKs from RESTRICT (default) to SET NULL,
-- and makes NOT NULL columns nullable where needed.

-- audit_runs.executed_by: NOT NULL → nullable, RESTRICT → SET NULL
alter table public.audit_runs
  alter column executed_by drop not null;

alter table public.audit_runs
  drop constraint if exists audit_runs_executed_by_fkey;

alter table public.audit_runs
  add constraint audit_runs_executed_by_fkey
    foreign key (executed_by)
    references public.profiles(id)
    on delete set null;

-- audit_runs.assigned_auditor_id: already nullable, change to SET NULL
alter table public.audit_runs
  drop constraint if exists audit_runs_assigned_auditor_id_fkey;

alter table public.audit_runs
  add constraint audit_runs_assigned_auditor_id_fkey
    foreign key (assigned_auditor_id)
    references public.profiles(id)
    on delete set null;

-- training_attendances.employee_profile_id: already nullable, change to SET NULL
alter table public.training_attendances
  drop constraint if exists training_attendances_employee_profile_id_fkey;

alter table public.training_attendances
  add constraint training_attendances_employee_profile_id_fkey
    foreign key (employee_profile_id)
    references public.profiles(id)
    on delete set null;

-- audit_corrective_actions.team_member_id: set null on profile delete
alter table public.audit_corrective_actions
  drop constraint if exists audit_corrective_actions_team_member_id_fkey;

alter table public.audit_corrective_actions
  add constraint audit_corrective_actions_team_member_id_fkey
    foreign key (team_member_id)
    references public.profiles(id)
    on delete set null;