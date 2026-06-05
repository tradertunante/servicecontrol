-- The audit-photos bucket was created as private, so getPublicUrl() returns URLs
-- that are inaccessible without auth headers (browsers can't load them in <img>).
-- Marking it public so that photo evidence renders correctly in the audit view.

update storage.buckets
  set public = true
  where id = 'audit-photos';