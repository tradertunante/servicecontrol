"use client";

import type { AreaSummaryStats } from "../_lib/analyticsTypes";

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-3xl font-black text-gray-900">{value}</span>
      {sub ? <span className="text-xs text-gray-400">{sub}</span> : null}
    </div>
  );
}

function TrendBar({
  fail_pct,
  max,
  label,
  audits,
}: {
  fail_pct: number | null;
  max: number;
  label: string;
  audits: number;
}) {
  const pct = fail_pct ?? 0;
  const barWidth = max > 0 ? (pct / max) * 100 : 0;
  const color = pct >= 20 ? "#ef4444" : pct >= 10 ? "#f59e0b" : "#22c55e";

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-right text-xs font-bold text-gray-500">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${barWidth}%`, background: color }}
        />
      </div>
      <span className="w-14 shrink-0 text-xs font-extrabold text-gray-700">
        {fail_pct !== null ? `${fail_pct.toFixed(1)}%` : "—"}
      </span>
      <span className="w-16 shrink-0 text-xs text-gray-400">{audits} aud.</span>
    </div>
  );
}

export default function AreaPanel({
  summary,
  areaLabel,
  selectedAreaId,
}: {
  summary: AreaSummaryStats | null;
  areaLabel: string;
  selectedAreaId: string;
}) {
  if (!summary) {
    return (
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center text-sm font-semibold text-gray-400">
        No hay auditorías en este período para {areaLabel}.
      </div>
    );
  }

  const lastDate = summary.last_audit_at
    ? new Date(summary.last_audit_at).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const maxPct = Math.max(...summary.trend.map((t) => t.fail_pct ?? 0), 1);

  return (
    <div className="mt-4 flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KPICard label="Auditorías" value={String(summary.audits_count)} sub={`Última: ${lastDate}`} />
        <KPICard
          label="% Fail global"
          value={summary.overall_fail_pct !== null ? `${summary.overall_fail_pct.toFixed(1)}%` : "—"}
          sub="preguntas respondidas"
        />
      </div>

      {/* Por template */}
      {summary.by_template.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-400">
            Por plantilla
          </div>
          <div className="divide-y divide-gray-50">
            {summary.by_template.map((row) => {
              const href = row.template_id
                ? `/team/historial?area=${selectedAreaId}&template=${row.template_id}`
                : `/team/historial?area=${selectedAreaId}`;

              return (
                <div key={row.template_id ?? "__none__"} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex-1 text-sm font-bold text-gray-800">{row.template_name}</span>
                  <span className="text-xs text-gray-400">{row.audits_count} aud.</span>
                  <span
                    className="w-16 text-right text-sm font-extrabold"
                    style={{
                      color:
                        row.fail_pct === null
                          ? "#9ca3af"
                          : row.fail_pct >= 20
                          ? "#ef4444"
                          : row.fail_pct >= 10
                          ? "#f59e0b"
                          : "#22c55e",
                    }}
                  >
                    {row.fail_pct !== null ? `${row.fail_pct.toFixed(1)}%` : "—"}
                  </span>
                  <a
                    href={href}
                    className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
                  >
                    Ver →
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tendencia semanal */}
      {summary.trend.length > 1 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-400">
            Tendencia semanal — % Fail
          </div>
          <div className="flex flex-col gap-2 px-5 py-4">
            {summary.trend.map((point) => (
              <TrendBar
                key={point.week_iso}
                label={point.week_label}
                fail_pct={point.fail_pct}
                audits={point.audits_count}
                max={maxPct}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}