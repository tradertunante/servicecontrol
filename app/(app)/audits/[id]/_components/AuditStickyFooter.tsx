"use client";

export default function AuditStickyFooter({
  submitting,
  submitted,
  saving,
  isOnline,
  onSave,
}: {
  submitting: boolean;
  submitted: boolean;
  saving: boolean;
  isOnline: boolean;
  onSave: () => void;
}) {
  const label = submitted
    ? "Enviada"
    : submitting
      ? "Enviando…"
      : !isOnline
        ? "Sin conexión"
        : saving
          ? "Guardando…"
          : "Enviar";

  return (
    <div data-onboarding="audit-submit" className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur lg:px-4 lg:py-3">
      <div>
        <button
          type="button"
          disabled={submitted || submitting || !isOnline}
          onClick={onSave}
          className="min-h-[48px] w-full rounded-xl bg-slate-900 px-3 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:text-sm"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
