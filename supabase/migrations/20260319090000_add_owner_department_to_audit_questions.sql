alter table public.audit_questions
add column if not exists owner_department text;
