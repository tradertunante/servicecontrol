"use client";

import { supabase } from "@/lib/supabaseClient";
import { toResponsibleDepartment } from "./responsibleDepartment";

import type {
  AnswerRow,
  AnswerValue,
  AreaRow,
  CorrectiveFlow,
  DraftSaveResponse,
  LoadedAuditSession,
  QuestionRow,
  RequirementType,
  SectionRow,
  TeamMemberLite,
  TemplateRow,
} from "./useAuditSession.types";

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

type RawTemplateRow = {
  id: string;
  name: string;
  require_room_number?: unknown;
  require_audited_employee?: unknown;
};

function toRequirement(value: unknown): RequirementType {
  if (value === "if_fail" || value === "always") return value;
  return "never";
}

function toCorrectiveFlow(value: unknown): CorrectiveFlow {
  if (value === "non_operational" || value === "mixed") return value;
  return "training_only";
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

function normalizeTemplate(template: RawTemplateRow): TemplateRow {
  return {
    id: template.id,
    name: template.name,
    require_room_number: Boolean(template.require_room_number),
    require_audited_employee: Boolean(template.require_audited_employee),
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
  const accessToken = await getAccessToken();

  // Single RPC call replaces the previous 8-query waterfall
  const response = await fetch(`/api/audits/${runId}/full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Error al cargar auditoría (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload?.ok || !payload?.data) {
    throw new Error(payload?.message ?? "Error desconocido al cargar auditoría.");
  }

  const { run, area, template, sections, questions: rawQuestions, answers: rawAnswers, teamMembers } = payload.data;

  // Normalize questions (enum coercion happens in the RPC now, but keep safety layer)
  const questions: QuestionRow[] = (rawQuestions ?? []).map((q: RawQuestionRow) => normalizeQuestion(q));

  // Build answers-by-question map
  const answersByQ = ((rawAnswers ?? []) as AnswerRow[]).reduce<Record<string, AnswerRow>>((acc, row) => {
    const normalized = normalizeAnswer(row);
    if (normalized) acc[normalized.question_id] = normalized;
    return acc;
  }, {});

  // Seed missing answers (still via separate endpoint — requires insert)
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
    run: run as LoadedAuditSession["run"],
    template: normalizeTemplate(template as RawTemplateRow),
    area: area as AreaRow,
    sections: (sections ?? []) as SectionRow[],
    questions,
    answersByQ,
    teamMembers: (teamMembers ?? []) as TeamMemberLite[],
  };
}
