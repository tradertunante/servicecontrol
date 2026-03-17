"use client";

import { supabase } from "@/lib/supabaseClient";

import type {
  AnswerRow,
  AnswerValue,
  AreaRow,
  CorrectiveFlow,
  DraftSaveResponse,
  LoadedAuditSession,
  QuestionRow,
  RequirementType,
  ResponsibleDepartment,
  SectionRow,
  TeamMemberLite,
  TemplateRow,
} from "./useAuditSession.types";

type LinkedTeamMemberRow = {
  team_member_id: string | null;
};

type RawQuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  weight: number | null;
  photo_requirement: unknown;
  comment_requirement: unknown;
  signature_requirement: unknown;
  active: boolean;
  order: number | null;
  created_at: string | null;
  tag?: string | null;
  classification?: string | null;
  corrective_flow: unknown;
  responsible_department: unknown;
  blocks_reaudit_until_resolved: unknown;
};

function toRequirement(value: unknown): RequirementType {
  if (value === "if_fail" || value === "always") return value;
  return "never";
}

function toCorrectiveFlow(value: unknown): CorrectiveFlow {
  if (value === "non_operational" || value === "mixed") return value;
  return "training_only";
}

function toResponsibleDepartment(value: unknown): ResponsibleDepartment {
  if (value === "engineering" || value === "systems") return value;
  return null;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function makeDraftAnswer(runId: string, questionId: string, current?: AnswerRow | null): AnswerRow {
  return {
    id: current?.id ?? "",
    audit_run_id: runId,
    question_id: questionId,
    answer: current?.answer ?? "PASS",
    result: current?.result ?? "PASS",
    comment: current?.comment ?? null,
    photo_path: current?.photo_path ?? null,
  };
}

export function shouldShowField(requirement: RequirementType, isFail: boolean): boolean {
  if (requirement === "always") return true;
  if (requirement === "if_fail") return isFail;
  return false;
}

export async function getAccessToken() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error("Sesion invalida.");
  }
  return accessToken;
}

function normalizeQuestion(question: RawQuestionRow): QuestionRow {
  return {
    ...question,
    photo_requirement: toRequirement(question.photo_requirement),
    comment_requirement: toRequirement(question.comment_requirement),
    signature_requirement: toRequirement(question.signature_requirement),
    corrective_flow: toCorrectiveFlow(question.corrective_flow),
    responsible_department: toResponsibleDepartment(question.responsible_department),
    blocks_reaudit_until_resolved: Boolean(question.blocks_reaudit_until_resolved),
  };
}

function normalizeAnswer(row: Partial<AnswerRow> & { question_id?: string | null }): AnswerRow | null {
  if (!row.question_id) return null;
  return {
    id: row.id ?? "",
    audit_run_id: row.audit_run_id ?? "",
    question_id: row.question_id,
    answer: (row.answer ?? null) as AnswerValue | null,
    result: (row.result ?? null) as AnswerValue | null,
    comment: row.comment ?? null,
    photo_path: row.photo_path ?? null,
  };
}

async function seedMissingAnswers(
  runId: string,
  seedPayload: Array<{
    question_id: string;
    answer: AnswerValue;
    result: AnswerValue;
    comment: string | null;
    photo_path: string | null;
  }>,
) {
  if (seedPayload.length === 0) return [];

  const accessToken = await getAccessToken();
  const response = await fetch(`/api/audits/${runId}/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ answers: seedPayload }),
  });

  const payload = (await response.json().catch(() => null)) as DraftSaveResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "No se pudo sembrar el draft de auditoría.");
  }

  return payload.answers ?? [];
}

export async function loadAuditSession(runId: string): Promise<LoadedAuditSession> {
  const { data: runData, error: runError } = await supabase
    .from("audit_runs")
    .select(
      "id,status,score,notes,room_number,executed_at,executed_by,audit_template_id,area_id,team_member_id,assigned_auditor_id,is_reaudit,parent_audit_run_id,origin_type,scheduled_for,requires_training,training_confirmed,ready_for_reaudit,blocking_issue_count",
    )
    .eq("id", runId)
    .single();

  if (runError || !runData) {
    throw runError ?? new Error("Auditoría no encontrada.");
  }

  const run = runData as LoadedAuditSession["run"];

  const [{ data: templateData, error: templateError }, { data: areaData, error: areaError }] =
    await Promise.all([
      supabase.from("audit_templates").select("id,name").eq("id", run.audit_template_id).single(),
      supabase.from("areas").select("id,name,type,hotel_id").eq("id", run.area_id).single(),
    ]);

  if (templateError || !templateData) throw templateError ?? new Error("Plantilla no encontrada.");
  if (areaError || !areaData) throw areaError ?? new Error("Área no encontrada.");

  const { data: linkData, error: linkError } = await supabase
    .from("team_member_areas")
    .select("team_member_id")
    .eq("area_id", run.area_id);

  if (linkError) throw linkError;

  const linkedTeamMemberIds = Array.from(
    new Set(
      ((linkData ?? []) as LinkedTeamMemberRow[])
        .map((entry) => entry.team_member_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let teamMembers: TeamMemberLite[] = [];
  if (linkedTeamMemberIds.length > 0) {
    let query = supabase
      .from("team_members")
      .select("id,full_name")
      .eq("active", true)
      .in("id", linkedTeamMemberIds)
      .order("full_name", { ascending: true });

    const hotelId = (areaData as AreaRow).hotel_id;
    if (hotelId) {
      query = query.eq("hotel_id", hotelId);
    }

    const { data: teamData, error: teamError } = await query;
    if (teamError) throw teamError;
    teamMembers = (teamData ?? []) as TeamMemberLite[];
  }

  if (run.team_member_id && !teamMembers.some((member) => member.id === run.team_member_id)) {
    const { data: fallbackMember, error: fallbackError } = await supabase
      .from("team_members")
      .select("id,full_name")
      .eq("id", run.team_member_id)
      .maybeSingle();

    if (!fallbackError && fallbackMember) {
      teamMembers = [{ ...(fallbackMember as TeamMemberLite), _outOfArea: true }, ...teamMembers];
    }
  }

  const { data: sectionData, error: sectionError } = await supabase
    .from("audit_sections")
    .select("id,name,active,created_at")
    .eq("audit_template_id", run.audit_template_id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (sectionError) throw sectionError;
  const sections = (sectionData ?? []) as SectionRow[];

  const sectionIds = sections.map((section) => section.id);
  let questions: QuestionRow[] = [];
  if (sectionIds.length > 0) {
    const { data: questionData, error: questionError } = await supabase
      .from("audit_questions")
      .select(
        "id,audit_section_id,text,weight,photo_requirement,comment_requirement,signature_requirement,active,order,created_at,tag,classification,corrective_flow,responsible_department,blocks_reaudit_until_resolved",
      )
      .in("audit_section_id", sectionIds)
      .eq("active", true)
      .order("audit_section_id", { ascending: true })
      .order("order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (questionError) throw questionError;
    questions = ((questionData ?? []) as RawQuestionRow[]).map(normalizeQuestion);
  }

  const { data: answerData, error: answerError } = await supabase
    .from("audit_answers")
    .select("id,audit_run_id,question_id,answer,result,comment,photo_path")
    .eq("audit_run_id", runId);

  if (answerError) throw answerError;

  const answersByQ = ((answerData ?? []) as AnswerRow[]).reduce<Record<string, AnswerRow>>((acc, row) => {
    const normalized = normalizeAnswer(row);
    if (normalized) acc[normalized.question_id] = normalized;
    return acc;
  }, {});

  const seedPayload = questions
    .filter((question) => !answersByQ[question.id] || !answersByQ[question.id]?.answer || !answersByQ[question.id]?.result)
    .map((question) => ({
      question_id: question.id,
      answer: (answersByQ[question.id]?.answer ?? "PASS") as AnswerValue,
      result: (answersByQ[question.id]?.result ?? "PASS") as AnswerValue,
      comment: answersByQ[question.id]?.comment ?? null,
      photo_path: answersByQ[question.id]?.photo_path ?? null,
    }));

  const seededAnswers = await seedMissingAnswers(runId, seedPayload);
  for (const answer of seededAnswers) {
    answersByQ[answer.question_id] = answer;
  }

  return {
    run,
    template: templateData as TemplateRow,
    area: areaData as AreaRow,
    sections,
    questions,
    answersByQ,
    teamMembers,
  };
}
