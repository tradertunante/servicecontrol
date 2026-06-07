"use client";

import { useState } from "react";

export default function AuditStickyFooter({
  submitting,
  submitted,
  saving,
  onSave,
}: {
  submitting: boolean;
  submitted: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  const label = submitted
    ? "Enviada"
    : submitting
      ? "Enviando…"
      : saving
        ? "Guardando…"
        : "Enviar";

  return (
    <>
      {showConfirm && (
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
                  onSave();
                }}
                className="flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-extrabold text-white"
              >
                Confirmar y enviar
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        data-onboarding="audit-submit"
        className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur lg:px-4 lg:py-3"
      >
        <div>
          <button
            type="button"
            disabled={submitted || submitting}
            onClick={() => {
              if (!submitted && !submitting) setShowConfirm(true);
            }}
            className="min-h-[48px] w-full rounded-xl bg-slate-900 px-3 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            {label}
          </button>
        </div>
      </div>
    </>
  );
}