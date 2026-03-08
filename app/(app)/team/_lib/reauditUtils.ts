// FILE: app/(app)/team/_lib/reauditUtils.ts

import type {
  ReassignmentInfo,
  TrainingInfo,
} from "./reauditTypes";

export function fmtDate(iso: string | null) {
  if (!iso) return "—";

  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayDiffFromNow(iso: string | null) {
  if (!iso) return null;

  const now = Date.now();
  const target = new Date(iso).getTime();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

export function buildTrainingConfirmationBlock({
  explanation,
  confirmedBy,
}: {
  explanation: string;
  confirmedBy: string;
}) {
  const stamp = new Date().toISOString();

  return [
    "--- TRAINING_CONFIRMATION ---",
    `confirmed_at: ${stamp}`,
    `confirmed_by: ${confirmedBy}`,
    `explanation: ${explanation.trim()}`,
    "--- /TRAINING_CONFIRMATION ---",
  ].join("\n");
}

export function buildReassignmentBlock({
  previousAuditorId,
  previousAuditorName,
  newAuditorId,
  newAuditorName,
  changedBy,
  reason,
  note,
}: {
  previousAuditorId: string | null;
  previousAuditorName: string | null;
  newAuditorId: string;
  newAuditorName: string | null;
  changedBy: string;
  reason: string;
  note: string;
}) {
  const stamp = new Date().toISOString();

  return [
    "--- REAUDIT_REASSIGNMENT ---",
    `changed_at: ${stamp}`,
    `changed_by: ${changedBy}`,
    `previous_auditor_id: ${previousAuditorId ?? ""}`,
    `previous_auditor_name: ${previousAuditorName ?? ""}`,
    `new_auditor_id: ${newAuditorId}`,
    `new_auditor_name: ${newAuditorName ?? ""}`,
    `reason: ${reason}`,
    `note: ${note.trim()}`,
    "--- /REAUDIT_REASSIGNMENT ---",
  ].join("\n");
}

export function extractLatestTrainingExplanation(
  notes: string | null
): TrainingInfo | null {
  if (!notes) return null;

  const regex =
    /--- TRAINING_CONFIRMATION ---([\s\S]*?)--- \/TRAINING_CONFIRMATION ---/g;

  const matches = Array.from(notes.matchAll(regex));
  if (!matches.length) return null;

  const block = matches[matches.length - 1]?.[1] ?? "";

  return {
    confirmedAt: block.match(/confirmed_at:\s*(.*)/i)?.[1]?.trim() ?? "",
    confirmedBy: block.match(/confirmed_by:\s*(.*)/i)?.[1]?.trim() ?? "",
    explanation: block.match(/explanation:\s*([\s\S]*)/i)?.[1]?.trim() ?? "",
  };
}

export function extractLatestReassignment(
  notes: string | null
): ReassignmentInfo | null {
  if (!notes) return null;

  const regex =
    /--- REAUDIT_REASSIGNMENT ---([\s\S]*?)--- \/REAUDIT_REASSIGNMENT ---/g;

  const matches = Array.from(notes.matchAll(regex));
  if (!matches.length) return null;

  const block = matches[matches.length - 1]?.[1] ?? "";

  return {
    changedAt: block.match(/changed_at:\s*(.*)/i)?.[1]?.trim() ?? "",
    changedBy: block.match(/changed_by:\s*(.*)/i)?.[1]?.trim() ?? "",
    previousAuditorName:
      block.match(/previous_auditor_name:\s*(.*)/i)?.[1]?.trim() ?? "",
    newAuditorName:
      block.match(/new_auditor_name:\s*(.*)/i)?.[1]?.trim() ?? "",
    reason: block.match(/reason:\s*(.*)/i)?.[1]?.trim() ?? "",
    note: block.match(/note:\s*([\s\S]*)/i)?.[1]?.trim() ?? "",
  };
}

export function appendNoteBlock(existingNotes: string | null, block: string) {
  const cleanExisting = (existingNotes ?? "").trim();
  if (!cleanExisting) return block;
  return `${cleanExisting}\n\n${block}`;
}