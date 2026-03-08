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

export type ReauditStats = {
  total: number;
  pendingTraining: number;
  blocked: number;
  ready: number;
};

export type TrainingInfo = {
  confirmedAt: string;
  confirmedBy: string | null;
  explanation: string;
};

export type ReassignmentInfo = {
  changedAt: string;
  changedBy: string | null;
  previousAuditorName: string | null;
  newAuditorName: string | null;
  note: string | null;
};

export type ReauditTrainingLogRow = {
  id: string;
  hotel_id: string;
  reaudit_run_id: string;
  team_member_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string;
  explanation: string;
  created_at: string | null;
};

export type ReauditAssignmentLogRow = {
  id: string;
  hotel_id: string;
  reaudit_run_id: string;
  previous_auditor_id: string | null;
  new_auditor_id: string;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
  created_at: string | null;
};

export type ReauditTimelineItem = {
  id: string;
  type: "training" | "assignment";
  occurredAt: string;
  title: string;
  actorName: string | null;
  detailLines: string[];
};