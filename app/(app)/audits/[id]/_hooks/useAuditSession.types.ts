import type { ResponsibleDepartment } from "./responsibleDepartment";
export type { ResponsibleDepartment };

export type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  notes: string | null;
  room_number: string | null;
  employee_name: string | null;
  executed_at: string | null;
  executed_by: string | null;
  audit_template_id: string;
  area_id: string;
  team_member_id: string | null;
  assigned_auditor_id: string | null;
  is_reaudit: boolean;
  parent_audit_run_id: string | null;
  origin_type: string | null;
  scheduled_for: string | null;
  requires_training: boolean;
  training_confirmed: boolean;
  ready_for_reaudit: boolean;
  blocking_issue_count: number;
};

export type TemplateRow = {
  id: string;
  name: string;
  require_room_number: boolean;
  require_audited_employee: boolean;
};

export type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
};

export type TeamMemberLite = {
  id: string;
  full_name: string;
  member_affinity?: "template" | "area" | "other";
};

export type SectionRow = {
  id: string;
  name: string;
  active: boolean | null;
  created_at: string | null;
};

export type RequirementType = "never" | "if_fail" | "always" | "optional";
export type CorrectiveFlow = "training_only" | "non_operational" | "mixed";
export type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  weight: number | null;
  photo_requirement: RequirementType;
  comment_requirement: RequirementType;
  signature_requirement: RequirementType;
  active: boolean;
  order: number | null;
  created_at: string | null;
  tag?: string | null;
  classification?: string | null;
  corrective_flow: CorrectiveFlow;
  responsible_department: ResponsibleDepartment;
  blocks_reaudit_until_resolved: boolean;
};

export type AnswerValue = "PASS" | "FAIL" | "NA";

export type AnswerRow = {
  id: string;
  audit_run_id: string;
  question_id: string;
  answer: AnswerValue | null;
  result: AnswerValue | null;
  comment: string | null;
  photo_path: string | null;
};

export type SubmitAuditResponse = {
  ok: boolean;
  code: string;
  message: string;
  data?: {
    run?: {
      id: string;
      status: string;
      score: number | null;
      is_reaudit: boolean;
    };
  } | null;
};

export type DraftSaveResponse = {
  ok: boolean;
  answers?: AnswerRow[];
  error?: string;
};

export type MetadataResponse = {
  ok: boolean;
  run?: Pick<AuditRunRow, "id" | "status" | "room_number" | "team_member_id">;
  error?: string;
};

export type LoadedAuditSession = {
  run: AuditRunRow;
  template: TemplateRow;
  area: AreaRow;
  sections: SectionRow[];
  questions: QuestionRow[];
  answersByQ: Record<string, AnswerRow>;
  teamMembers: TeamMemberLite[];
};
