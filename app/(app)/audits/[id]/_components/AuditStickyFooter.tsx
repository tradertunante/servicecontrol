"use client";

export default function AuditStickyFooter({
  canGoPrevious,
  canGoNext,
  submitting,
  submitted,
  saving,
  onPrevious,
  onNext,
  onSave,
}: {
  canGoPrevious: boolean;
  canGoNext: boolean;
  submitting: boolean;
  submitted: boolean;
  saving: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canGoPrevious}
          onClick={onPrevious}
          className="min-h-[48px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={onNext}
          className="min-h-[48px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>

        <button
          type="button"
          disabled={submitted || submitting}
          onClick={onSave}
          className="min-h-[48px] flex-[1.2] rounded-2xl bg-slate-900 px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitted ? "Enviada" : submitting ? "Enviando…" : saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
