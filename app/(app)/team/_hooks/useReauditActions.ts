// FILE: app/(app)/team/_hooks/useReauditActions.ts
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

import type { EnrichedReauditRow } from "../_lib/reauditTypes";

export function useReauditActions({
  profile,
  onReload,
}: {
  profile: Profile | null;
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

    if (!profile?.id) {
      setActionError(
        "No se pudo identificar al usuario que confirma el training."
      );
      setMessage("");
      return false;
    }

    setSavingId(row.id);
    setActionError("");
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida.");

      const response = await fetch("/api/reaudits/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "confirm_training",
          run_id: row.id,
          explanation: cleanExplanation,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo confirmar el training.");
      }

      const nextReady = Boolean(payload?.ready_for_reaudit);

      setMessage(
        nextReady
          ? "Training confirmado y documentado. La re-auditoría ya está lista para ejecutarse."
          : "Training confirmado y documentado. La re-auditoría sigue bloqueada por incidencias no operativas."
      );

      onSuccess?.();
      await onReload();
      return true;
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "No se pudo confirmar el training.");
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function saveReassignment({
    row,
    nextAuditorId,
    note,
    onSuccess,
  }: {
    row: EnrichedReauditRow;
    nextAuditorId: string;
    note: string;
    onSuccess?: () => void;
  }) {
    const cleanAuditorId = nextAuditorId.trim();
    const cleanNote = note.trim();

    if (!cleanAuditorId) {
      setActionError(
        "Debes seleccionar un auditor para reasignar la re-auditoría."
      );
      setMessage("");
      return false;
    }

    if (cleanAuditorId === (row.assigned_auditor_id ?? "")) {
      setActionError("Selecciona un auditor diferente al actual.");
      setMessage("");
      return false;
    }

    if (row.status === "submitted") {
      setActionError("No se puede reasignar una re-auditoría ya cerrada.");
      setMessage("");
      return false;
    }

    if (!profile?.id) {
      setActionError(
        "No se pudo identificar al usuario que realiza la reasignación."
      );
      setMessage("");
      return false;
    }

    setSavingId(row.id);
    setActionError("");
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sesión inválida.");

      const response = await fetch("/api/reaudits/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "reassign_auditor",
          run_id: row.id,
          next_auditor_id: cleanAuditorId,
          note: cleanNote,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo reasignar el auditor.");
      }

      setMessage("Auditor reasignado correctamente para la re-auditoría.");

      onSuccess?.();
      await onReload();
      return true;
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "No se pudo reasignar el auditor.");
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
