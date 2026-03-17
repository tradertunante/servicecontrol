"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { useAuditAutosave } from "./useAuditAutosave";
import {
  getAccessToken,
  getErrorMessage,
  loadAuditSession,
  makeDraftAnswer,
  shouldShowField,
} from "./useAuditSession.lib";
import type {
  AnswerRow,
  AnswerValue,
  DraftSaveResponse,
  MetadataResponse,
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
  const { pendingCount, scheduleSave, flushAll } = useAuditAutosave();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [run, setRun] = useState<import("./useAuditSession.types").AuditRunRow | null>(null);
  const [template, setTemplate] = useState<import("./useAuditSession.types").TemplateRow | null>(null);
  const [area, setArea] = useState<import("./useAuditSession.types").AreaRow | null>(null);
  const [sections, setSections] = useState<import("./useAuditSession.types").SectionRow[]>([]);
  const [questions, setQuestions] = useState<import("./useAuditSession.types").QuestionRow[]>([]);
  const [answersByQ, setAnswersByQ] = useState<Record<string, AnswerRow>>({});
  const [teamMembers, setTeamMembers] = useState<import("./useAuditSession.types").TeamMemberLite[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [savingRoomNumber, setSavingRoomNumber] = useState(false);

  const saving = pendingCount > 0;
  const submitted = (run?.status ?? "") === "submitted";
  const isHousekeeping = (area?.type ?? "").toUpperCase() === "HK";

  useEffect(() => {
    if (!runId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const session = await loadAuditSession(runId);
        if (!alive) return;

        setRun(session.run);
        setTemplate(session.template);
        setArea(session.area);
        setSections(session.sections);
        setQuestions(session.questions);
        setAnswersByQ(session.answersByQ);
        setTeamMembers(session.teamMembers);
        setSelectedMember(session.run.team_member_id ?? "");
        setRoomNumber(session.run.room_number ?? "");
        setLoading(false);
      } catch (sessionError: unknown) {
        if (!alive) return;
        setError(getErrorMessage(sessionError, "Error cargando auditoría."));
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [runId]);

  const totals = useMemo(() => {
    const total = questions.length;
    let answered = 0;
    let fail = 0;
    let na = 0;

    for (const question of questions) {
      const answer = answersByQ[question.id];
      const value = (answer?.answer ?? answer?.result ?? null) as AnswerValue | null;
      if (!value) continue;
      answered += 1;
      if (value === "FAIL") fail += 1;
      if (value === "NA") na += 1;
    }

    const denom = Math.max(0, total - na);
    const pass = Math.max(0, denom - fail);
    const score = denom === 0 ? null : Math.round((pass / denom) * 100 * 10) / 10;

    return { total, answered, fail, na, denom, pass, score };
  }, [answersByQ, questions]);

  const groupedQuestions = useMemo(() => {
    const grouped: Record<string, import("./useAuditSession.types").QuestionRow[]> = {};
    for (const question of questions) {
      if (!grouped[question.audit_section_id]) {
        grouped[question.audit_section_id] = [];
      }
      grouped[question.audit_section_id]!.push(question);
    }
    return grouped;
  }, [questions]);

  async function persistAnswerDraft(questionId: string, draft: AnswerRow) {
    if (!runId) return;

    const accessToken = await getAccessToken();
    const response = await fetch(`/api/audits/${runId}/draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        answers: [
          {
            question_id: questionId,
            answer: draft.answer,
            result: draft.result,
            comment: draft.comment,
            photo_path: draft.photo_path,
          },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as DraftSaveResponse | null;
    if (!response.ok || !payload?.ok || !payload.answers?.[0]) {
      throw new Error(payload?.error ?? "No se pudo guardar.");
    }

    setAnswersByQ((prev) => ({
      ...prev,
      [questionId]: payload.answers![0],
    }));
  }

  function updateAnswerDraft(questionId: string, updater: (draft: AnswerRow) => AnswerRow) {
    if (!runId) return null;

    let nextDraft: AnswerRow | null = null;
    setAnswersByQ((prev) => {
      nextDraft = updater(makeDraftAnswer(runId, questionId, prev[questionId]));
      return {
        ...prev,
        [questionId]: nextDraft!,
      };
    });
    return nextDraft;
  }

  function setAnswer(questionId: string, nextValue: AnswerValue) {
    if (!runId || submitted) return;

    setError(null);
    const nextDraft = updateAnswerDraft(questionId, (draft) => ({
      ...draft,
      answer: nextValue,
      result: nextValue,
    }));

    if (!nextDraft) return;

    scheduleSave(`answer:${questionId}`, async () => {
      try {
        await persistAnswerDraft(questionId, nextDraft);
      } catch (saveError: unknown) {
        setError(getErrorMessage(saveError, "No se pudo guardar la respuesta."));
      }
    });
  }

  function setComment(questionId: string, comment: string) {
    if (!runId || submitted) return;

    setError(null);
    const nextDraft = updateAnswerDraft(questionId, (draft) => ({
      ...draft,
      comment,
    }));

    if (!nextDraft) return;

    scheduleSave(`answer:${questionId}`, async () => {
      try {
        await persistAnswerDraft(questionId, nextDraft);
      } catch (saveError: unknown) {
        setError(getErrorMessage(saveError, "No se pudo guardar el comentario."));
      }
    });
  }

  async function saveTeamMember(nextId: string) {
    if (!run || submitted) return;

    setSavingMember(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/audits/${run.id}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ team_member_id: nextId || null }),
      });

      const payload = (await response.json().catch(() => null)) as MetadataResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "No se pudo asignar el colaborador.");
      }

      setSelectedMember(payload.run?.team_member_id ?? "");
      setRun((prev) =>
        prev
          ? {
              ...prev,
              team_member_id: payload.run?.team_member_id ?? (nextId || null),
            }
          : prev,
      );
    } catch (memberError: unknown) {
      setError(getErrorMessage(memberError, "No se pudo asignar el colaborador."));
    } finally {
      setSavingMember(false);
    }
  }

  async function saveRoomNumber(nextValue: string) {
    if (!run || submitted || !isHousekeeping) return;

    const trimmedValue = nextValue.trim();
    setSavingRoomNumber(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/audits/${run.id}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ room_number: trimmedValue || null }),
      });

      const payload = (await response.json().catch(() => null)) as MetadataResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar el numero de habitacion.");
      }

      const nextRoomNumber = payload.run?.room_number ?? (trimmedValue || null);
      setRoomNumber(nextRoomNumber ?? "");
      setRun((prev) => (prev ? { ...prev, room_number: nextRoomNumber } : prev));
    } catch (roomError: unknown) {
      setError(getErrorMessage(roomError, "No se pudo guardar el numero de habitacion."));
    } finally {
      setSavingRoomNumber(false);
    }
  }

  async function uploadPhoto(questionId: string, file: File) {
    if (!runId || submitted) return;

    const current = answersByQ[questionId];
    if (!current) {
      setError("No existe respuesta para esta pregunta.");
      return;
    }

    const question = questions.find((entry) => entry.id === questionId);
    const selectedValue = ((current.answer ?? current.result) ?? "PASS") as AnswerValue;
    const allowPhoto = question?.photo_requirement === "always" || selectedValue === "FAIL";
    if (!allowPhoto) {
      setError("Para subir foto, marca FAIL o usa una pregunta con foto obligatoria.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const extension = file.name.split(".").pop() || "jpg";
      const fileName = `${runId}_${questionId}_${timestamp}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("audit-photos").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("audit-photos").getPublicUrl(fileName);
      const nextDraft = {
        ...makeDraftAnswer(runId, questionId, current),
        photo_path: urlData.publicUrl,
      };

      setAnswersByQ((prev) => ({
        ...prev,
        [questionId]: nextDraft,
      }));

      await persistAnswerDraft(questionId, nextDraft);
    } catch (photoError: unknown) {
      setError(getErrorMessage(photoError, "No se pudo subir la foto."));
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(questionId: string) {
    if (!runId || submitted) return;

    const current = answersByQ[questionId];
    if (!current?.photo_path) return;

    setError(null);
    try {
      const fileName = current.photo_path.split("/").pop() ?? "";
      if (fileName) {
        const { error: storageError } = await supabase.storage.from("audit-photos").remove([fileName]);
        if (storageError) {
          console.warn("Error eliminando de Storage:", storageError);
        }
      }

      const nextDraft = {
        ...makeDraftAnswer(runId, questionId, current),
        photo_path: null,
      };

      setAnswersByQ((prev) => ({
        ...prev,
        [questionId]: nextDraft,
      }));

      await persistAnswerDraft(questionId, nextDraft);
    } catch (photoError: unknown) {
      setError(getErrorMessage(photoError, "No se pudo eliminar la foto."));
    }
  }

  async function submitRun() {
    if (!run || !area || submitted) return;

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
    setError(null);

    try {
      await flushAll();
      const accessToken = await getAccessToken();

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
      setSubmitting(false);
    }
  }

  return {
    loading,
    saving,
    uploading,
    submitting,
    savingMember,
    error,
    submitted,
    run,
    template,
    area,
    sections,
    questions,
    groupedQuestions,
    answersByQ,
    teamMembers,
    selectedMember,
    roomNumber,
    savingRoomNumber,
    isHousekeeping,
    totals,
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
