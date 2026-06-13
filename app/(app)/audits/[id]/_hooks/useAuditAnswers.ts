"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import {
  getAccessToken,
  getErrorMessage,
  makeDraftAnswer,
} from "./useAuditSession.lib";
import { resizeImage } from "@/lib/image/resizeImage";
import { saveAnswerLocally } from "@/lib/offline/auditIdb";
import type {
  AnswerRow,
  AnswerValue,
  DraftSaveResponse,
  QuestionRow,
} from "./useAuditSession.types";

export function useAuditAnswers({
  runId,
  submitted,
  questions,
  answersByQ,
  setAnswersByQ,
  setError,
  scheduleSave,
}: {
  runId: string | undefined;
  submitted: boolean;
  questions: QuestionRow[];
  answersByQ: Record<string, AnswerRow>;
  setAnswersByQ: React.Dispatch<React.SetStateAction<Record<string, AnswerRow>>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  scheduleSave: (key: string, action: () => Promise<void>) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function persistAnswerDraft(questionId: string, draft: AnswerRow) {
    if (!runId) return;

    const accessToken = await getAccessToken();
    const response = await fetch(`/api/audits/${runId}/draft`, {
      method: "POST",
      keepalive: true,
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
            photo_paths: draft.photo_paths ?? [],
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

    // Persist to IndexedDB immediately (fire-and-forget) so offline reloads
    // can restore the auditor's latest edits without waiting for the network save.
    if (nextDraft && runId) {
      saveAnswerLocally(runId, nextDraft);
    }

    return nextDraft;
  }

  function setAnswer(questionId: string, nextValue: AnswerValue) {
    if (!runId || submitted) return;
    setError(null);

    const prevAnswer = answersByQ[questionId];

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
        setAnswersByQ((prev) => ({
          ...prev,
          [questionId]: prevAnswer ?? makeDraftAnswer(runId, questionId),
        }));
        setError(getErrorMessage(saveError, "No se pudo guardar la respuesta."));
      }
    });
  }

  function setComment(questionId: string, comment: string) {
    if (!runId || submitted) return;
    setError(null);

    const prevAnswer = answersByQ[questionId];

    const nextDraft = updateAnswerDraft(questionId, (draft) => ({
      ...draft,
      comment,
    }));

    if (!nextDraft) return;

    scheduleSave(`answer:${questionId}`, async () => {
      try {
        await persistAnswerDraft(questionId, nextDraft);
      } catch (saveError: unknown) {
        setAnswersByQ((prev) => ({
          ...prev,
          [questionId]: prevAnswer ?? makeDraftAnswer(runId, questionId),
        }));
        setError(getErrorMessage(saveError, "No se pudo guardar el comentario."));
      }
    });
  }

  const MAX_PHOTOS = 5;

  async function uploadPhoto(questionId: string, file: File) {
    if (!runId || submitted) return;

    if (!navigator.onLine) {
      setError("Sin conexión. Conéctate para subir fotos.");
      return;
    }

    const current = answersByQ[questionId];
    if (!current) {
      setError("No existe respuesta para esta pregunta.");
      return;
    }

    const currentPhotos = current.photo_paths ?? [];
    if (currentPhotos.length >= MAX_PHOTOS) {
      setError(`Máximo ${MAX_PHOTOS} fotos por pregunta.`);
      return;
    }

    const question = questions.find((entry) => entry.id === questionId);
    const selectedValue = ((current.answer ?? current.result) ?? "PASS") as AnswerValue;
    const allowPhoto = question?.photo_requirement === "always" || question?.photo_requirement === "optional" || selectedValue === "FAIL";
    if (!allowPhoto) {
      setError("Para subir foto, marca FAIL o usa una pregunta con foto obligatoria.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const resized = await resizeImage(file);
      const timestamp = Date.now();
      const extension = resized.name.split(".").pop() || "jpg";
      const fileName = `${runId}_${questionId}_${timestamp}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("audit-photos").upload(fileName, resized, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      // El bucket es privado: se guarda la ruta del endpoint que firma y
      // redirige (/api/photos/[fileName]), válida como src en toda la app.
      const newPhotos = [...currentPhotos, `/api/photos/${fileName}`];
      const nextDraft = {
        ...makeDraftAnswer(runId, questionId, current),
        photo_paths: newPhotos,
        photo_path: newPhotos[0],
      };

      setAnswersByQ((prev) => ({
        ...prev,
        [questionId]: nextDraft,
      }));

      saveAnswerLocally(runId, nextDraft);
      await persistAnswerDraft(questionId, nextDraft);
    } catch (photoError: unknown) {
      setError(getErrorMessage(photoError, "No se pudo subir la foto."));
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(questionId: string, index: number) {
    if (!runId || submitted) return;

    if (!navigator.onLine) {
      setError("Sin conexión. Conéctate para eliminar fotos.");
      return;
    }

    const current = answersByQ[questionId];
    const currentPhotos = current?.photo_paths ?? [];
    const urlToDelete = currentPhotos[index];
    if (!urlToDelete) return;

    setError(null);
    try {
      const fileName = urlToDelete.split("/").pop() ?? "";
      if (fileName) {
        const { error: storageError } = await supabase.storage.from("audit-photos").remove([fileName]);
        if (storageError) {
          console.warn("Error eliminando de Storage:", storageError);
        }
      }

      const newPhotos = currentPhotos.filter((_, i) => i !== index);
      const nextDraft = {
        ...makeDraftAnswer(runId, questionId, current),
        photo_paths: newPhotos,
        photo_path: newPhotos[0] ?? null,
      };

      setAnswersByQ((prev) => ({
        ...prev,
        [questionId]: nextDraft,
      }));

      saveAnswerLocally(runId, nextDraft);
      await persistAnswerDraft(questionId, nextDraft);
    } catch (photoError: unknown) {
      setError(getErrorMessage(photoError, "No se pudo eliminar la foto."));
    }
  }

  return { setAnswer, setComment, uploadPhoto, deletePhoto, uploading };
}