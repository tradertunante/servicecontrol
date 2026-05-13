-- Trial behavior tracking: three signals for Brevo activation sequence
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_login_at        timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS first_audit_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_expires_at      timestamptz DEFAULT NULL;