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
    <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur lg:px-4 lg:py-3">
      <div className="grid grid-cols-[1fr_1fr_1.15fr] items-center gap-2">
        <button
          type="button"
          disabled={!canGoPrevious}
          onClick={onPrevious}
          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:px-4 sm:text-sm"
        >
          Anterior
        </button>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={onNext}
          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:px-4 sm:text-sm"
        >
          Siguiente
        </button>

        <button
          type="button"
          disabled={submitted || submitting}
          onClick={onSave}
          className="min-h-[48px] rounded-xl bg-slate-900 px-3 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:text-sm"
        >
          {submitted ? "Enviada" : submitting ? "Enviando…" : saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
