-- contact_email stores the real email for mystery shoppers
-- profiles.email holds the generated login email (ms-xxx@servicecontrol.io)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_email text DEFAULT NULL;