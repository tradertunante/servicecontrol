"use client";

import { useMemo } from "react";
import type { AuditRunRow } from "../_lib/dashboardTypes";
import { getMonthScore, getYearAverage } from "../_lib/dashboardUtils";

type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; active?: boolean | null };
type TemplateRow = { id: string; name: string; hotel_id: string | null };

export type AreaRankingItem = {
  areaId: string;
  areaName: string;
  avg: number | null;
  count: number;
  trend3m: { key: string; avg: number | null; count: number }[];
};

export type WorstAuditItem = {
  areaId: string;
  areaName: string;
  templateId: string;
  templateName: string;
  score: number | null;
  executed_at: string | null;
};

function build3MonthTrend(areaRuns: AuditRunRow[]) {
  const points: { key: string; avg: number | null; count: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const score = getMonthScore(areaRuns, d.getFullYear(), d.getMonth());
    const key = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").slice(0, 3);
    points.push({ key: key.charAt(0).toUpperCase() + key.slice(1), avg: score.avg, count: score.count });
  }
  return points;
}

export function useDashboardRankings({
  areas,
  runs,
  runsByArea,
  templateById,
  selectedYear,
}: {
  areas: AreaRow[];
  runs: AuditRunRow[];
  runsByArea: Map<string, AuditRunRow[]>;
  templateById: Map<string, TemplateRow>;
  selectedYear: number;
}) {
  const areaById = useMemo(() => {
    const map = new Map<string, AreaRow>();
    for (const a of areas) map.set(a.id, a);
    return map;
  }, [areas]);

  const { top3Areas, worst3Areas } = useMemo(() => {
    const items: AreaRankingItem[] = areas.map((a) => {
      const aruns = runsByArea.get(a.id) ?? [];
      const yr = getYearAverage(aruns, selectedYear);
      const trend = build3MonthTrend(aruns);
      return { areaId: a.id, areaName: a.name, avg: yr.avg, count: yr.count, trend3m: trend };
    });

    const withAvg = items.filter((x) => typeof x.avg === "number");
    const top = [...withAvg].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)).slice(0, 3);
    const worst = [...withAvg].sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999)).slice(0, 3);
    return { top3Areas: top, worst3Areas: worst };
  }, [areas, runsByArea, selectedYear]);

  const worst3Audits = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const month = now.getMonth();

    const monthRuns = runs
      .filter((r) => r.executed_at)
      .filter((r) => {
        const d = new Date(r.executed_at!);
        return d.getFullYear() === y && d.getMonth() === month;
      })
      .map((r) => ({ r, score: Number(r.score) }))
      .filter((x) => Number.isFinite(x.score));

    return monthRuns
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(({ r }) => {
        const a = areaById.get(r.area_id);
        const t = templateById.get(r.audit_template_id);
        return {
          areaId: r.area_id,
          areaName: a?.name ?? "Área",
          templateId: r.audit_template_id,
          templateName: (t?.name ?? "Auditoría").trim() || "Auditoría",
          score: r.score == null ? null : Number(r.score),
          executed_at: r.executed_at ?? null,
        } as WorstAuditItem;
      });
  }, [runs, templateById, areaById]);

  return { top3Areas, worst3Areas, worst3Audits };
}
