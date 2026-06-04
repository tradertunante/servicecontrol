-- Backfill invited_at for all admin-created hotel users that were missed
-- by the previous migration (the interval condition was too restrictive).
-- These are non-trial users with a hotel_id, created by an admin, not self-signup.
update public.profiles
set invited_at = created_at
where invited_at is null
  and hotel_id is not null
  and is_trial = false
  and created_at is not null;