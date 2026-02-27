// FILE: app/(app)/analytics/_components/MemberPanel.tsx
"use client";

import type {
  MemberReport,
  MemberTopStandardRow,
  MemberTrendRow,
  TeamMemberLite,
  TemplateLite,
} from "../_lib/analyticsTypes";

import MemberTrendChart from "./MemberTrendChart";

function successPctFromFail(fail: number | null) {
  if (fail === null || fail === undefined) return null;
  const v = 100 - fail;
  return Math.max(0, Math.min(100, v));
}

export default function MemberPanel({
  summary,
  members,
  templates,
  selectedMemberId,
  setSelectedMemberId,
  memberAuditMode,
  setMemberAuditMode,
  report,
  trend,
  topStandards,
}: {
  summary: string;
  members: TeamMemberLite[];
  templates: TemplateLite[];
  selectedMemberId: string;
  setSelectedMemberId: (v: string) => void;
  memberAuditMode: string;
  setMemberAuditMode: (v: string) => void;
  report: MemberReport | null;
  trend: MemberTrendRow[];
  topStandards: MemberTopStandardRow[];
}) {
  const showDistribution = memberAuditMode === "all";

  return (
    <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold">Datos por colaborador</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            Selecciona un colaborador y un tipo de auditoría para ver su progreso y puntos de mejora.
          </div>
        </div>

        <div className="rounded-2xl border bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700">
          {summary}
        </div>
      </div>

      {/* ✅ Quitamos "Resumen" y dejamos 2 columnas */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-xs font-extrabold text-gray-500">Colaborador</label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
            disabled={members.length === 0}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
          {members.length === 0 ? (
            <div className="text-xs font-semibold text-gray-500">
              No hay colaboradores con auditorías en este filtro.
            </div>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-extrabold text-gray-500">Auditoría</label>
          <select
            value={memberAuditMode}
            onChange={(e) => setMemberAuditMode(e.target.value)}
            className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
          >
            <option value="all">General (todas)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                Por tipo: {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-gray-50 p-4">
          <div className="text-xs font-extrabold text-gray-500">Nº auditorías</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">
            {/* ✅ si no hay report aún, mostramos —; si hay report, mostramos el número (incluyendo 0) */}
            {report ? report.audits_count : "—"}
          </div>
        </div>

        <div className="rounded-2xl border bg-gray-50 p-4">
          <div className="text-xs font-extrabold text-gray-500">% Éxito general</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">
            {report?.overall_fail_pct === null || report?.overall_fail_pct === undefined
              ? "—"
              : `${successPctFromFail(report.overall_fail_pct)!.toFixed(2)}%`}
          </div>
        </div>

        <div className="rounded-2xl border bg-gray-50 p-4">
          <div className="text-xs font-extrabold text-gray-500">Distribución por tipo</div>

          {showDistribution && report?.by_template?.length ? (
            <div className="mt-2 space-y-2">
              {report.by_template.slice(0, 5).map((t) => {
                const success = t.fail_pct === null ? null : successPctFromFail(t.fail_pct);
                return (
                  <div
                    key={t.template_id ?? "null"}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="text-xs font-semibold text-gray-800 truncate">
                      {t.template_name}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="rounded-full border bg-white px-2.5 py-1 text-[11px] font-extrabold text-gray-800">
                        {t.audits_pct.toFixed(2)}%
                      </span>
                      <span className="rounded-full border bg-white px-2.5 py-1 text-[11px] font-extrabold text-gray-800">
                        Éxito {success === null ? "—" : `${success.toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 text-sm font-semibold text-gray-600">—</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Progresión en el tiempo</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">
                Éxito% por auditoría (ordenado por fecha).
              </div>
            </div>
            <div className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-700">
              Top {trend.length}
            </div>
          </div>

          <div className="mt-3">
            <MemberTrendChart trend={trend} />
          </div>

          {trend.length === 0 ? (
            <div className="mt-3 text-sm font-semibold text-gray-600">
              No hay auditorías para este colaborador con el filtro seleccionado.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-left py-2 pr-3">Fecha</th>
                    <th className="text-left py-2 pr-3">Tipo</th>
                    <th className="text-right py-2 pl-3">Éxito%</th>
                    <th className="text-right py-2 pl-3">Fallos</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.slice(-20).map((r) => {
                    const success = successPctFromFail(r.fail_pct);
                    return (
                      <tr key={r.run_id} className="border-t">
                        <td className="py-2 pr-3 text-xs font-semibold text-gray-700">
                          {r.executed_at ? new Date(r.executed_at).toLocaleDateString("es-ES") : "—"}
                        </td>
                        <td className="py-2 pr-3 text-xs font-semibold text-gray-700">
                          {r.template_name}
                        </td>
                        <td className="py-2 pl-3 text-right font-extrabold">
                          {success === null ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            `${success.toFixed(2)}%`
                          )}
                        </td>
                        <td className="py-2 pl-3 text-right text-xs font-semibold text-gray-700">
                          {r.fails}/{r.answered}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-2 text-[11px] font-semibold text-gray-500">
                Mostrando las últimas 20 auditorías del periodo.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Estándares más fallados</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">
                Top por nº de FAIL (según el filtro de auditoría).
              </div>
            </div>
            <div className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-700">
              Top {topStandards.length}
            </div>
          </div>

          {topStandards.length === 0 ? (
            <div className="mt-3 text-sm font-semibold text-gray-600">
              Sin fallos (o sin datos) en este filtro.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {topStandards.map((s, idx) => (
                <div key={`${s.question_id}-${idx}`} className="rounded-2xl border bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div style={{ minWidth: 0 }}>
                      <div className="text-sm font-extrabold text-gray-900 break-words">
                        {s.standard}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-gray-600">
                        {s.tag || s.classification ? (
                          <>
                            {s.tag ? (
                              <span className="mr-2">
                                <span className="font-extrabold text-gray-700">Tag:</span>{" "}
                                {s.tag}
                              </span>
                            ) : null}
                            {s.classification ? (
                              <span>
                                <span className="font-extrabold text-gray-700">Clasificación:</span>{" "}
                                {s.classification}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <span className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-800">
                        {s.fail_count} FAIL
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}