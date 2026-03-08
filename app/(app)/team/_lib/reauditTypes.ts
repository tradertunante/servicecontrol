// FILE: app/(app)/team/_lib/reauditTypes.ts

export type ReauditRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  team_member_id: string | null;
  assigned_auditor_id: string | null;
  parent_audit_run_id: string | null;
  status: string | null;
  score: number | null;
  scheduled_for: string | null;
  requires_training: boolean | null;
  training_confirmed: boolean | null;
  ready_for_reaudit: boolean | null;
  blocking_issue_count: number | null;
  origin_type: string | null;
  notes: string | null;
  executed_at: string | null;
};

export type AreaRow = {
  id: string;
  name: string;
  type: string | null;
};

export type TemplateRow = {
  id: string;
  name: string;
};

export type TeamMemberRow = {
  id: string;
  full_name: string;
};

export type ProfileLite = {
  id: string;
  full_name: string | null;
  role?: string | null;
  hotel_id?: string | null;
  active?: boolean | null;
};

export type EnrichedReauditRow = ReauditRow & {
  area_name: string | null;
  area_type: string | null;
  template_name: string | null;
  team_member_name: string | null;
  assigned_auditor_name: string | null;
};

export type ReassignReason =
  | "workload"
  | "schedule"
  | "absence"
  | "objectivity"
  | "other";

export type ReauditStats = {
  total: number;
  pendingTraining: number;
  blocked: number;
  ready: number;
};

export type TrainingInfo = {
  confirmedAt: string;
  confirmedBy: string;
  explanation: string;
};

export type ReassignmentInfo = {
  changedAt: string;
  changedBy: string;
  previousAuditorName: string;
  newAuditorName: string;
  reason: string;
  note: string;
};