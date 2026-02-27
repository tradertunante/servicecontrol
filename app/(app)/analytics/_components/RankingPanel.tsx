"use client";

import type { RankingRow, SortDir, SortKey, TemplateLite } from "../_lib/analyticsTypes";
import SortHeader from "./SortHeader";

export default function RankingPanel({
  ranking,
  templates,
  rankingMode,
  setRankingMode,
  sortKey,
  sortDir,
  toggleSort,
}: {
  ranking: RankingRow[];
  templates: TemplateLite[];
  rankingMode: string;
  setRankingMode: (v: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  toggleSort: (k: SortKey) => void;
}) {
  return (
    <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold">Ranking por colaborador</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            NA no cuenta. Puedes ordenar por cualquier columna.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-extrabold text-gray-500">Vista</label>
            <select
              value={rankingMode}
              onChange={(e) => setRankingMode(e.target.value)}
              className="rounded-2xl border bg-white px-3 py-2 text-xs font-extrabold outline-none focus:border-black"
            >
              <option value="all">Ranking general (todas)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  Por tipo: {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700">
            {ranking.length} colaboradores
          </div>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="mt-4 text-sm font-semibold text-gray-600">
          No hay auditorías con colaborador en este periodo (con los filtros actuales).
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left py-2 pr-3">
                  <SortHeader
                    label="Colaborador"
                    active={sortKey === "name"}
                    dir={sortKey === "name" ? sortDir : "desc"}
                    onClick={() => toggleSort("name")}
                  />
                </th>

                <th className="text-right py-2 pl-3">
                  <SortHeader
                    label="Nº auditorías"
                    active={sortKey === "audits_count"}
                    dir={sortKey === "audits_count" ? sortDir : "desc"}
                    onClick={() => toggleSort("audits_count")}
                    align="right"
                  />
                </th>

                <th className="text-right py-2 pl-3">
                  <SortHeader
                    label="% FAIL"
                    active={sortKey === "fail_rate_pct"}
                    dir={sortKey === "fail_rate_pct" ? sortDir : "desc"}
                    onClick={() => toggleSort("fail_rate_pct")}
                    align="right"
                  />
                </th>

                <th className="text-right py-2 pl-3">
                  <SortHeader
                    label="Última"
                    active={sortKey === "last_audit_at"}
                    dir={sortKey === "last_audit_at" ? sortDir : "desc"}
                    onClick={() => toggleSort("last_audit_at")}
                    align="right"
                  />
                </th>
              </tr>
            </thead>

            <tbody>
              {ranking.map((r) => (
                <tr key={r.team_member_id} className="border-t">
                  <td className="py-3 pr-3">
                    <div className="font-extrabold text-gray-900">{r.name}</div>
                  </td>

                  <td className="py-3 pl-3 text-right font-extrabold text-gray-900">
                    {r.audits_count}
                  </td>

                  <td className="py-3 pl-3 text-right font-extrabold">
                    {r.fail_rate_pct === null ? (
                      <span className="text-gray-500">—</span>
                    ) : (
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 border",
                          r.fail_rate_pct >= 20
                            ? "bg-red-50 border-red-200 text-red-700"
                            : r.fail_rate_pct >= 10
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-green-50 border-green-200 text-green-700",
                        ].join(" ")}
                      >
                        {r.fail_rate_pct.toFixed(2)}%
                      </span>
                    )}
                  </td>

                  <td className="py-3 pl-3 text-right text-xs font-semibold text-gray-600">
                    {r.last_audit_at ? new Date(r.last_audit_at).toLocaleDateString("es-ES") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}