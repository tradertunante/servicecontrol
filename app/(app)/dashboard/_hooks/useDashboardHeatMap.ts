"use client";

import { useMemo } from "react";
import type { AuditRunRow } from "../_lib/dashboardTypes";
import {
  type HeatMode,
  buildMonthLabelsForYear,
  buildMonthLabelsRolling12M,
  buildMonthSlots,
  getMonthScore,
  getYearAverage,
  getRolling12MScore,
} from "../_lib/dashboardUtils";

type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; active?: boolean | null; sort_order?: number | null };
type TemplateRow = { id: string; name: string; hotel_id: string | null };
type HeatCell = { value: number | null; count: number };
type RunsByArea = Map<string, AuditRunRow[]>;

export type HeatRow = {
  key: string;
  group: string;
  label: string;
  months: HeatCell[];
  kind: "area" | "audit";
  parentKey?: string;
  channel?: "internal" | "quality";
  channelLabel?: string;
  compareTag?: "internal" | "quality";
};

function groupRunsByArea(runs: AuditRunRow[]): RunsByArea {
  const byArea = new Map<string, AuditRunRow[]>();
  for (const run of runs) {
    const existing = byArea.get(run.area_id);
    if (existing) { existing.push(run); continue; }
    byArea.set(run.area_id, [run]);
  }
  return byArea;
}

function buildHeatRows(
  areas: AreaRow[],
  runsByArea: RunsByArea,
  templateById: Map<string, TemplateRow>,
  heatMode: HeatMode,
  selectedYear: number,
  channel?: "internal" | "quality"
): HeatRow[] {
  const slots = buildMonthSlots(heatMode, selectedYear);

  const buildCells = (subRuns: AuditRunRow[]) => {
    const cells = slots.map((s) => {
      const sc = getMonthScore(subRuns, s.year, s.month);
      return { value: sc.avg, count: sc.count };
    });
    const media = heatMode === "YEAR" ? getYearAverage(subRuns, selectedYear) : getRolling12MScore(subRuns);
    cells.push({ value: media.avg, count: media.count });
    return cells;
  };

  const norm = (s: string) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const rows: HeatRow[] = [];

  for (const a of areas) {
    const areaKey = channel ? `area:${a.id}:${channel}` : `area:${a.id}`;
    const areaRuns = runsByArea.get(a.id) ?? [];

    rows.push({
      key: areaKey, group: a.type ?? "—", label: a.name,
      months: buildCells(areaRuns), kind: "area", channel,
    });

    const buckets = new Map<string, { name: string; runs: AuditRunRow[] }>();
    for (const r of areaRuns) {
      const tid = r.audit_template_id;
      if (!tid) continue;
      const t = templateById.get(tid);
      const name = (t?.name ?? "Auditoría").trim() || "Auditoría";
      const k = norm(name);
      if (!buckets.has(k)) buckets.set(k, { name, runs: [] });
      buckets.get(k)!.runs.push(r);
    }

    const children = Array.from(buckets.values()).sort((x, y) => x.name.localeCompare(y.name, "es"));
    for (const c of children) {
      rows.push({
        key: `${areaKey}:audit:${norm(c.name)}`, parentKey: areaKey,
        group: a.type ?? "—", label: c.name,
        months: buildCells(c.runs), kind: "audit", channel,
      });
    }
  }

  return rows;
}

export function useDashboardHeatMap({
  areas,
  templates,
  runs,
  heatMode,
  selectedYear,
}: {
  areas: AreaRow[];
  templates: TemplateRow[];
  runs: AuditRunRow[];
  heatMode: HeatMode;
  selectedYear: number;
}) {
  const templateById = useMemo(() => {
    const map = new Map<string, TemplateRow>();
    for (const t of templates) map.set(t.id, t);
    return map;
  }, [templates]);

  const runsByArea = useMemo(() => groupRunsByArea(runs), [runs]);

  const internalRuns = useMemo(
    () => runs.filter((r) => (r.audit_channel ?? "internal") === "internal"),
    [runs]
  );
  const qualityRuns = useMemo(
    () => runs.filter((r) => r.audit_channel === "quality"),
    [runs]
  );

  const internalRunsByArea = useMemo(() => groupRunsByArea(internalRuns), [internalRuns]);
  const qualityRunsByArea = useMemo(() => groupRunsByArea(qualityRuns), [qualityRuns]);

  const heatMapData = useMemo(
    () => buildHeatRows(areas, runsByArea, templateById, heatMode, selectedYear),
    [areas, runsByArea, templateById, heatMode, selectedYear]
  );
  const heatMapDataInternal = useMemo(
    () => buildHeatRows(areas, internalRunsByArea, templateById, heatMode, selectedYear, "internal"),
    [areas, internalRunsByArea, templateById, heatMode, selectedYear]
  );
  const heatMapDataQuality = useMemo(
    () => buildHeatRows(areas, qualityRunsByArea, templateById, heatMode, selectedYear, "quality"),
    [areas, qualityRunsByArea, templateById, heatMode, selectedYear]
  );

  const monthLabels = useMemo(
    () => heatMode === "YEAR" ? buildMonthLabelsForYear() : buildMonthLabelsRolling12M(),
    [heatMode]
  );

  return {
    heatMapData, heatMapDataInternal, heatMapDataQuality, monthLabels,
    runsByArea, templateById,
  };
}
