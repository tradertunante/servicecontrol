ALTER TABLE trial_leads
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS trial_leads_ip_created_idx ON trial_leads (ip_address, created_at);