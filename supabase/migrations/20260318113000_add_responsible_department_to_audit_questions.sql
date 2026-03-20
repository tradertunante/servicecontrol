alter table public.audit_questions
add column if not exists responsible_department text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_questions_responsible_department_check'
  ) then
    alter table public.audit_questions
    add constraint audit_questions_responsible_department_check
    check (
      responsible_department is null
      or responsible_department in (
        'housekeeping',
        'front_office',
        'f&b',
        'it',
        'engineering',
        'systems'
      )
    );
  end if;
end
$$;
