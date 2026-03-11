"use client";

export default function AuditProgressBar({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
        <span>
          {answered}/{total} respondidas
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
