export type AuditLogEntityType =
  | "team_target_assignment"
  | "area_template_target"
  | "member_role"
  | "audit_run";

export type AuditLogAction =
  | "create"
  | "update"
  | "deactivate"
  | "reactivate"
  | "execute"
  | "complete"
  | "assign"
  | "unassign";

export type AuditLogEntryInput = {
  hotel_id: string;
  actor_user_id?: string | null;
  entity_type: AuditLogEntityType;
  entity_id: string;
  action: AuditLogAction;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditLogRecord = {
  id: string;
  hotel_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  entity_type: AuditLogEntityType;
  entity_id: string;
  action: AuditLogAction;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
