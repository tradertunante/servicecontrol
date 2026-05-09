-- RLS for trial_leads: only service_role (used by supabaseAdmin) can read/write.
-- Regular authenticated users have no business accessing this table.

ALTER TABLE trial_leads ENABLE ROW LEVEL SECURITY;