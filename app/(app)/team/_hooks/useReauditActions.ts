// FILE: app/(app)/team/_hooks/useReauditActions.ts
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

import type {
  EnrichedReauditRow,
  ProfileLite,
  ReassignReason,
} from "../_lib/reauditTypes";

import {
  appendNoteBlock,
  buildReassignmentBlock,
  buildTrainingConfirmationBlock,
} from "../_lib/reauditUtils";

export function useReauditActions({
  profile,
  auditorOptions,
  onReload,
}: {
  profile: Profile | null;
  auditorOptions: ProfileLite[];
  onReload: () => Promise<void>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");

  async function confirmTraining({
    row,
    explanation,
    onSuccess,
  }: {
    row: EnrichedReauditRow;
    explanation: string;
    onSuccess?: () => void;
  }) {
    const cleanExplanation = explanation.trim();

    if (!cleanExplanation) {
      setActionError(
        "Debes explicar qué formación o medida correctiva se realizó antes de confirmar el training."
      );
      setMessage("");
      return false;
    }

    if (cleanExplanation.length < 12) {
      setActionError(
        "La explicación es demasiado corta. Añade suficiente detalle para futura trazabilidad."
      );
      setMessage("");
      return false;
    }

    setSavingId(row.id);
    setActionError("");
    setMessage("");

    try {
      const blockingIssueCount = Number(row.blocking_issue_count ?? 0);
      const nextReady = blockingIssueCount === 0;
      const nextStatus = nextReady ? "draft" : "blocked_by_non_operational";

      const confirmedBy = profile?.full_name?.trim() || profile?.id || "unknown";

      const trainingBlock = buildTrainingConfirmationBlock({
        explanation: cleanExplanation,
        confirmedBy,
      });

      const nextNotes = appendNoteBlock(row.notes, trainingBlock);

      const { error: updateErr } = await supabase
        .from("audit_runs")
        .update({
          training_confirmed: true,
          blocking_issue_count: blockingIssueCount,
          ready_for_reaudit: nextReady,
          status: nextStatus,
          notes: nextNotes,
        })
        .eq("id", row.id);

      if (updateErr) throw updateErr;

      setMessage(
        nextReady
          ? "Training confirmado y documentado. La re-auditoría ya está lista para ejecutarse."
          : "Training confirmado y documentado. La re-auditoría sigue bloqueada por incidencias no operativas."
      );

      onSuccess?.();
      await onReload();
      return true;
    } catch (e: any) {
      setActionError(e?.message || "No se pudo confirmar el training.");
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function saveReassignment({
    row,
    nextAuditorId,
    reason,
    note,
    onSuccess,
  }: {
    row: EnrichedReauditRow;
    nextAuditorId: string;
    reason: ReassignReason;
    note: string;
    onSuccess?: () => void;
  }) {
    const cleanAuditorId = nextAuditorId.trim();
    const cleanNote = note.trim();

    if (!cleanAuditorId) {
      setActionError("Debes seleccionar un auditor para reasignar la re-auditoría.");
      setMessage("");
      return false;
    }

    if (cleanAuditorId === (row.assigned_auditor_id ?? "")) {
      setActionError("Selecciona un auditor diferente al actual.");
      setMessage("");
      return false;
    }

    if (row.executed_at) {
      setActionError("No se puede reasignar una re-auditoría ya ejecutada.");
      setMessage("");
      return false;
    }

    setSavingId(row.id);
    setActionError("");
    setMessage("");

    try {
      const newAuditor = auditorOptions.find((p) => p.id === cleanAuditorId);
      const changedBy = profile?.full_name?.trim() || profile?.id || "unknown";

      const reassignBlock = buildReassignmentBlock({
        previousAuditorId: row.assigned_auditor_id,
        previousAuditorName: row.assigned_auditor_name,
        newAuditorId: cleanAuditorId,
        newAuditorName: newAuditor?.full_name ?? null,
        changedBy,
        reason,
        note: cleanNote,
      });

      const nextNotes = appendNoteBlock(row.notes, reassignBlock);

      const { error: updateErr } = await supabase
        .from("audit_runs")
        .update({
          assigned_auditor_id: cleanAuditorId,
          notes: nextNotes,
        })
        .eq("id", row.id);

      if (updateErr) throw updateErr;

      setMessage("Auditor reasignado correctamente para la re-auditoría.");

      onSuccess?.();
      await onReload();
      return true;
    } catch (e: any) {
      setActionError(e?.message || "No se pudo reasignar el auditor.");
      return false;
    } finally {
      setSavingId(null);
    }
  }

  function clearActionFeedback() {
    setActionError("");
    setMessage("");
  }

  return {
    savingId,
    actionError,
    message,
    setActionError,
    setMessage,
    clearActionFeedback,
    confirmTraining,
    saveReassignment,
  };
}