-- Change the DB default for comment_requirement and photo_requirement to 'optional'.
-- Also backfill all existing questions that still have 'never' on these two fields,
-- since 'never' was the original system default and no manual override should be lost.

alter table public.audit_questions
  alter column comment_requirement set default 'optional',
  alter column photo_requirement   set default 'optional';

update public.audit_questions
  set comment_requirement = 'optional'
  where comment_requirement = 'never';

update public.audit_questions
  set photo_requirement = 'optional'
  where photo_requirement = 'never';