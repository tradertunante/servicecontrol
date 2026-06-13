"use client";

export default function AuditStickyFooter({
  submitting,
  submitted,
  saving,
  onReview,
}: {
  submitting: boolean;
  submitted: boolean;
  saving: boolean;
  onReview: () => void;
}) {
  const label = submitted
    ? "Enviada"
    : submitting
      ? "Enviando…"
      : saving
        ? "Guardando…"
        : "Finalizar";

  return (
    <div
      data-onboarding="audit-submit"
      className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur lg:px-4 lg:py-3"
    >
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Subir al inicio"
          className="min-h-[48px] shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 text-slate-600 sm:rounded-2xl"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          type="button"
          disabled={submitted || submitting}
          onClick={() => {
            if (!submitted && !submitting) onReview();
          }}
          className="min-h-[48px] flex-1 rounded-xl bg-slate-900 px-3 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:text-sm"
        >
          {label}
        </button>
      </div>
    </div>
  );
}