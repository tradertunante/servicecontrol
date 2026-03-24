import { NextRequest, NextResponse } from "next/server";

import { authorizeAuditRunAccess } from "@/lib/audits/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { logger } from "@/lib/logger";

type AnswerValue = "PASS" | "FAIL" | "NA";

type DraftAnswerInput = {
  question_id?: unknown;
  answer?: unknown;
  result?: unknown;
  comment?: unknown;
  photo_path?: unknown;
};

function normalizeAnswerValue(value: unknown): AnswerValue | null {
  if (value === "PASS" || value === "FAIL" || value === "NA") {
    return value;
  }
  return null;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const runId = parseUUID(params?.id, "id");
  if (isErrorResponse(runId)) return runId;

  const access = await authorizeAuditRunAccess(request, runId, { requireDraft: true });
  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  const body = await request.json().catch(() => null);
  const rawAnswers = Array.isArray(body?.answers) ? (body.answers as DraftAnswerInput[]) : [];
  if (rawAnswers.length === 0) {
    return jsonError("answers debe ser un arreglo no vacío.");
  }

  const deduped = new Map<
    string,
    {
      audit_run_id: string;
      question_id: string;
      answer: AnswerValue;
      result: AnswerValue;
      comment: string | null;
      photo_path: string | null;
    }
  >();

  for (const entry of rawAnswers) {
    const questionId = typeof entry?.question_id === "string" ? entry.question_id.trim() : "";
    if (!questionId) {
      return jsonError("Cada answer debe incluir question_id.");
    }

    const answer = normalizeAnswerValue(entry?.answer);
    const result = normalizeAnswerValue(entry?.result ?? entry?.answer);
    if (!answer || !result) {
      return jsonError(`Valor de respuesta inválido para question_id=${questionId}.`);
    }

    deduped.set(questionId, {
      audit_run_id: access.run.id,
      question_id: questionId,
      answer,
      result,
      comment: normalizeNullableString(entry?.comment),
      photo_path: normalizeNullableString(entry?.photo_path),
    });
  }

  const questionIds = Array.from(deduped.keys());
  const admin = supabaseAdmin();

  const { data: questions, error: questionError } = await admin
    .from("audit_questions")
    .select("id, audit_section_id")
    .in("id", questionIds);

  if (questionError) {
    logger.error("draft_question_lookup_failed", { runId, error: questionError.message });
    return jsonError("Error interno al verificar preguntas.", 500);
  }
  if ((questions ?? []).length !== questionIds.length) {
    return jsonError("Hay preguntas inválidas o inexistentes.", 400);
  }

  const sectionIds = Array.from(
    new Set((questions ?? []).map((question) => String(question.audit_section_id ?? "")).filter(Boolean)),
  );

  const { data: sections, error: sectionError } = await admin
    .from("audit_sections")
    .select("id, audit_template_id")
    .in("id", sectionIds);

  if (sectionError) {
    logger.error("draft_section_lookup_failed", { runId, error: sectionError.message });
    return jsonError("Error interno al verificar secciones.", 500);
  }

  const sectionTemplateIds = new Map(
    (sections ?? []).map((section) => [String(section.id), String(section.audit_template_id ?? "")]),
  );

  for (const question of questions ?? []) {
    const templateId = sectionTemplateIds.get(String(question.audit_section_id ?? ""));
    if (!templateId || templateId !== String(access.run.audit_template_id ?? "")) {
      return jsonError(
        "No se pueden guardar respuestas para preguntas fuera del template de la auditoría.",
        403,
      );
    }
  }

  const payload = Array.from(deduped.values());
  const { data, error } = await admin
    .from("audit_answers")
    .upsert(payload, { onConflict: "audit_run_id,question_id" })
    .select("id,audit_run_id,question_id,answer,result,comment,photo_path");

  if (error) {
    logger.error("draft_upsert_failed", { runId, error: error.message });
    return jsonError("Error interno al guardar respuestas.", 500);
  }

  return NextResponse.json({
    ok: true,
    answers: data ?? [],
  });
}
