"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useAuditSessionContext } from "../_context/AuditSessionContext";
import { pickQuestionText } from "@/lib/i18n/questionText";

export default function AuditReviewScreen({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  const {
    sections,
    groupedQuestions,
    answersByQ,
    submitting,
    submitted,
    saving,
    submitRun: onSubmit,
  } = useAuditSessionContext();

  const [showConfirm, setShowConfirm] = useState(false);

  const exceptions = sections.flatMap((section) =>
    (groupedQuestions[section.id] ?? [])
      .map((q) => ({ section, question: q, answer: answersByQ[q.id] ?? null }))
      .filter(({ answer }) => {
        const value = answer?.answer ?? answer?.result ?? "PASS";
        return value === "FAIL" || value === "NA";
      })
  );

  const totalQuestions = sections.reduce(
    (sum, s) => sum + (groupedQuestions[s.id]?.length ?? 0),
    0
  );
  const passCount = totalQuestions - exceptions.length;

  const submitLabel = submitted
    ? "Enviada"
    : submitting
      ? "Enviando…"
      : saving
        ? "Guardando…"
        : "Enviar auditoría";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-600 disabled:opacity-40"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver
        </button>
        <h2 className="flex-1 text-sm font-extrabold text-slate-900">
          Revisión previa al envío
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {exceptions.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-800">
              Todo en orden — todas las preguntas en PASS.
            </div>
          ) : (
            <>
              <div className="text-sm font-extrabold text-slate-700">
                {exceptions.length}{" "}
                {exceptions.length === 1
                  ? "excepción encontrada"
                  : "excepciones encontradas"}
              </div>

              {exceptions.map(({ section, question, answer }) => {
                const value = answer?.answer ?? answer?.result ?? "PASS";
                const isFail = value === "FAIL";

                return (
                  <div
                    key={question.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {section.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
                          isFail
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {value}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900">
                      {pickQuestionText(question.text, question.text_en, locale)}
                    </p>

                    {answer?.comment ? (
                      <p className="mt-2 text-sm text-slate-500">
                        &ldquo;{answer.comment}&rdquo;
                      </p>
                    ) : null}

                    {answer?.photo_paths && answer.photo_paths.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {answer.photo_paths.map((path, i) => (
                          <img
                            key={i}
                            src={path}
                            alt={`Foto ${i + 1}`}
                            className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}

          {passCount > 0 ? (
            <p className="py-1 text-center text-sm font-semibold text-slate-400">
              ✓ {passCount} {passCount === 1 ? "pregunta en PASS" : "preguntas en PASS"}
            </p>
          ) : null}
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900">¿Enviar auditoría?</h3>
            <p className="mt-1.5 text-sm text-slate-500">
              Una vez enviada no podrás modificar las respuestas.
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onSubmit();
                }}
                className="flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-extrabold text-white"
              >
                Confirmar y enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white/95 px-4 py-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          disabled={submitted || submitting}
          onClick={() => {
            if (!submitted && !submitting) setShowConfirm(true);
          }}
          className="min-h-[48px] w-full rounded-xl bg-slate-900 px-3 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:text-sm"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}