"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

import { useAuditAutosave } from "./useAuditAutosave";
import { useAuditLoader } from "./useAuditLoader";
import { useAuditAnswers } from "./useAuditAnswers";
import { useAuditMetadata } from "./useAuditMetadata";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import {
  getAccessToken,
  getErrorMessage,
  makeDraftAnswer,
  shouldShowField,
} from "./useAuditSession.lib";
import type {
  AnswerValue,
  DraftSaveResponse,
  SubmitAuditResponse,
} from "./useAuditSession.types";

export type {
  AnswerRow,
  AnswerValue,
  AreaRow,
  AuditRunRow,
  CorrectiveFlow,
  QuestionRow,
  RequirementType,
  ResponsibleDepartment,
  SectionRow,
  TeamMemberLite,
  TemplateRow,
} from "./useAuditSession.types";

export function useAuditSession(runId: string | undefined) {
  const router = useRouter();
  const { pendingCount, scheduleSave: rawScheduleSave, flushAll } = useAuditAutosave();
  const isOnline = useOnlineStatus();

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Block new saves while submit is in progress to prevent race condition
  const scheduleSave: typeof rawScheduleSave = useCallback(
    (key, action) => {
      if (submittingRef.current) return;
      rawScheduleSave(key, action);
    },
    [rawScheduleSave],
  );

  const loaderState = useAuditLoader(runId);

  const {
    error, setError,
    run, setRun,
    questions,
    answersByQ, setAnswersByQ,
    selectedMember, setSelectedMember,
    roomNumber, setRoomNumber,
    submitted,
    requiresAuditedEmployee,
    requiresRoomNumber,
    showRoomNumberField,
  } = loaderState;

  const { setAnswer, setComment, uploadPhoto, deletePhoto, uploading } = useAuditAnswers({
    runId,
    submitted,
    questions,
    answersByQ,
    setAnswersByQ,
    setError,
    scheduleSave,
  });

  const { saveTeamMember, saveRoomNumber, savingMember, savingRoomNumber } = useAuditMetadata({
    run,
    submitted,
    showRoomNumberField,
    selectedMember,
    setSelectedMember,
    roomNumber,
    setRoomNumber,
    setError,
    setRun,
  });

  const saving = pendingCount > 0;

  async function submitRun() {
    if (!run || !loaderState.area || submitted) return;

    if (!navigator.onLine) {
      setError("Sin conexión. Envía la auditoría cuando recuperes la señal.");
      return;
    }

    if (requiresAuditedEmployee && !selectedMember.trim()) {
      setError("Debes seleccionar el colaborador auditado antes de enviar esta auditoría.");
      return;
    }

    if (requiresRoomNumber && !roomNumber.trim()) {
      setError("Debes capturar el número de habitación antes de enviar esta auditoría.");
      return;
    }

    for (const question of questions) {
      const answer = answersByQ[question.id];
      if (!answer) continue;

      const value = ((answer.answer ?? answer.result) ?? "PASS") as AnswerValue;
      const shouldValidateComment =
        question.comment_requirement === "always" ||
        (question.comment_requirement === "if_fail" && value === "FAIL");
      const shouldValidatePhoto =
        question.photo_requirement === "always" ||
        (question.photo_requirement === "if_fail" && value === "FAIL");

      if (shouldValidateComment && !(answer.comment ?? "").trim()) {
        setError(`Falta comentario en: "${question.text}"`);
        return;
      }

      if (shouldValidatePhoto && !(answer.photo_path ?? "").trim()) {
        setError(`Falta foto en: "${question.text}"`);
        return;
      }
    }

    setSubmitting(true);
    submittingRef.current = true;
    setError(null);

    try {
      try {
        await flushAll();
      } catch (flushError: unknown) {
        setError(getErrorMessage(flushError, "Error guardando respuestas pendientes. Intenta de nuevo."));
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      const accessToken = await getAccessToken();

      const submitAnswersPayload = questions.map((question) => {
        const current = answersByQ[question.id];
        const draft = {
          ...makeDraftAnswer(run.id, question.id, current),
          answer: ((current?.answer ?? current?.result) ?? "PASS") as AnswerValue,
          result: ((current?.result ?? current?.answer) ?? "PASS") as AnswerValue,
          comment: current?.comment ?? null,
          photo_path: current?.photo_path ?? null,
        };
        return {
          question_id: question.id,
          answer: draft.answer,
          result: draft.result,
          comment: draft.comment,
          photo_path: draft.photo_path,
        };
      });

      const draftResponse = await fetch(`/api/audits/${run.id}/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ answers: submitAnswersPayload }),
      });

      const draftPayload = (await draftResponse.json().catch(() => null)) as DraftSaveResponse | null;
      if (!draftResponse.ok || !draftPayload?.ok) {
        throw new Error(draftPayload?.error ?? "No se pudo persistir el estado actual antes de enviar.");
      }

      const response = await fetch("/api/audits/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ run_id: run.id }),
      });

      const payload = (await response.json().catch(() => null)) as SubmitAuditResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "No se pudo enviar la auditoría.");
      }

      const failCount = submitAnswersPayload.filter((a) => a.answer === "FAIL").length;
      posthog.capture("audit_completed", {
        run_id: run.id,
        score: payload.data?.run?.score ?? null,
        fail_count: failCount,
      });
      if (failCount > 0) {
        posthog.capture("finding_registered", { run_id: run.id, count: failCount });
      }

      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: payload.data?.run?.status ?? "submitted",
              score: payload.data?.run?.score ?? prev.score,
            }
          : prev,
      );

      router.push(`/audits/${run.id}/view`);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, "No se pudo enviar la auditoría."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return {
    loading: loaderState.loading,
    isOnline,
    saving,
    uploading,
    submitting,
    savingMember,
    error,
    submitted,
    run,
    template: loaderState.template,
    area: loaderState.area,
    sections: loaderState.sections,
    questions,
    groupedQuestions: loaderState.groupedQuestions,
    answersByQ,
    teamMembers: loaderState.teamMembers,
    selectedMember,
    roomNumber,
    savingRoomNumber,
    isHousekeeping: loaderState.isHousekeeping,
    requiresRoomNumber,
    requiresAuditedEmployee,
    showRoomNumberField,
    totals: loaderState.totals,
    setAnswer,
    setComment,
    uploadPhoto,
    deletePhoto,
    saveTeamMember,
    saveRoomNumber,
    submitRun,
    setSelectedMember,
    setRoomNumber,
    shouldShowField,
  };
}
