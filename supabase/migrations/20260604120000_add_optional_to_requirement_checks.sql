-- The original check constraints for comment/photo/signature_requirement
-- only allowed ('never', 'if_fail', 'always').
-- The UI added 'optional' as a valid value but the DB constraints were never updated.
-- This migration drops the old constraints and recreates them with 'optional' included.

alter table public.audit_questions
  drop constraint if exists audit_questions_comment_requirement_check,
  drop constraint if exists audit_questions_photo_requirement_check,
  drop constraint if exists audit_questions_signature_requirement_check;

alter table public.audit_questions
  add constraint audit_questions_comment_requirement_check
    check (comment_requirement in ('never', 'if_fail', 'optional', 'always')),
  add constraint audit_questions_photo_requirement_check
    check (photo_requirement in ('never', 'if_fail', 'optional', 'always')),
  add constraint audit_questions_signature_requirement_check
    check (signature_requirement in ('never', 'if_fail', 'optional', 'always'));