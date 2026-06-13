-- Add due_date and assigned_to fields to support the unified corrective actions inbox
ALTER TABLE audit_corrective_actions
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aca_assigned_to ON audit_corrective_actions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_aca_due_date ON audit_corrective_actions(due_date) WHERE due_date IS NOT NULL;