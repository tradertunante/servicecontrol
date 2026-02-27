"use client";

import type { AreaRow, Period } from "../_lib/analyticsTypes";

export default function AnalyticsFilters({
  areas,
  selectedAreaId,
  setSelectedAreaId,
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  summary,
}: {
  areas: AreaRow[];
  selectedAreaId: string;
  setSelectedAreaId: (v: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  summary: string;
}) {
  return (
    <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-extrabold mb-3">Filtros</div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-extrabold text-gray-500">Área</label>
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
            disabled={areas.length === 0}
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.type ? `${a.name} · ${a.type}` : a.name}
              </option>
            ))}
          </select>

          {areas.length === 0 ? (
            <div className="text-xs font-semibold text-gray-500 mt-1">
              No tienes áreas asignadas.
            </div>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-extrabold text-gray-500">Periodo</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
          >
            <option value="30">Últimos 30 días</option>
            <option value="60">Últimos 60 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="365">Últimos 12 meses</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-extrabold text-gray-500">Resumen</label>
          <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            {summary}
          </div>
        </div>
      </div>

      {period === "custom" ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-extrabold text-gray-500">Desde</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-extrabold text-gray-500">Hasta</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-extrabold text-gray-500">Tip</label>
            <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
              Si dejas “Hasta” vacío, usa hoy.
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}