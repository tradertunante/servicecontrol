// FILE: app/(app)/dashboard/_hooks/useDashboardData.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import type { Profile, AuditRunRow } from "../_lib/dashboardTypes";
import {
  type HeatMode,
  buildMonthLabelsForYear,
  buildMonthLabelsRolling12M,
  buildMonthSlots,
  getMonthScore,
  getRolling12MScore,
  getYearAverage,
  getCurrentQuarter,
  getQuarterScore,
  getYearScore,
} from "../_lib/dashboardUtils";

export const HOTEL_KEY = "sc_hotel_id";

type HotelRow = { id: string; name: string; active: boolean | null; status: string | null };
type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; active?: boolean | null };
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
};

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

function groupRunsByArea(runs: AuditRunRow[]): RunsByArea {
  const byArea = new Map<string, AuditRunRow[]>();

  for (const run of runs) {
    const existing = byArea.get(run.area_id);
    if (existing) {
      existing.push(run);
      continue;
    }

    byArea.set(run.area_id, [run]);
  }

  return byArea;
}

function build3MonthTrendFromAreaRuns(areaRuns: AuditRunRow[]) {
  const points: { key: string; avg: number | null; count: number }[] = [];

  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const score = getMonthScore(areaRuns, d.getFullYear(), d.getMonth());
    const key = d
      .toLocaleDateString("es-ES", { month: "short" })
      .replace(".", "")
      .slice(0, 3);

    points.push({
      key: key.charAt(0).toUpperCase() + key.slice(1),
      avg: score.avg,
      count: score.count,
    });
  }

  return points;
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
      key: areaKey,
      group: a.type ?? "—",
      label: a.name,
      months: buildCells(areaRuns),
      kind: "area",
      channel,
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
        key: `${areaKey}:audit:${norm(c.name)}`,
        parentKey: areaKey,
        group: a.type ?? "—",
        label: c.name,
        months: buildCells(c.runs),
        kind: "audit",
        channel,
      });
    }
  }

  return rows;
}

export function useDashboardData({
  profile,
  selectedHotelId,
  setSelectedHotelId,
  heatMode,
  selectedYear,
}: {
  profile: Profile | null;
  selectedHotelId: string | null;
  setSelectedHotelId: (s: string | null) => void;
  heatMode: HeatMode;
  selectedYear: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [selectedHotelName, setSelectedHotelName] = useState<string>("");

  const canChooseHotel = profile?.role === "superadmin";

  const resetForHotelChange = () => {
    setAreas([]);
    setTemplates([]);
    setRuns([]);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile) return;
      if (!selectedHotelId) { setLoading(false); return; }

      setLoading(true);
      setError(null);

      try {
        const hotelsPromise = canChooseHotel
          ? supabase.from("hotels").select("id,name,active,status").order("name")
          : Promise.resolve({ data: null, error: null });

        const selectedHotelPromise = canChooseHotel
          ? Promise.resolve({ data: null, error: null })
          : supabase.from("hotels").select("id,name").eq("id", selectedHotelId).single();

        const areasPromise = supabase
          .from("areas")
          .select("id,name,type,hotel_id,active")
          .eq("hotel_id", selectedHotelId)
          .eq("active", true)
          .order("name");

        const templatesPromise = supabase
          .from("audit_templates")
          .select("id,name,hotel_id")
          .or(`hotel_id.eq.${selectedHotelId},hotel_id.is.null`)
          .order("name");

        const runsPromise = supabase
          .from("audit_runs")
          .select("id,area_id,audit_template_id,executed_at,score,audit_channel")
          .eq("hotel_id", selectedHotelId)
          .eq("status", "submitted")
          .not("executed_at", "is", null)
          .not("score", "is", null);

        const [hotelsRes, selectedHotelRes, areasRes, templatesRes, runsRes] = await Promise.all([
          hotelsPromise,
          selectedHotelPromise,
          areasPromise,
          templatesPromise,
          runsPromise,
        ]);

        if (hotelsRes.error) throw hotelsRes.error;
        if (selectedHotelRes.error) throw selectedHotelRes.error;
        if (areasRes.error) throw areasRes.error;
        if (templatesRes.error) throw templatesRes.error;
        if (runsRes.error) throw runsRes.error;
        if (!alive) return;

        const hotelsData = (hotelsRes.data ?? []) as HotelRow[];
        const selectedHotelData = selectedHotelRes.data as { id: string; name: string } | null;

        setHotels(hotelsData);
        setSelectedHotelName(
          canChooseHotel
            ? hotelsData.find((hotel) => hotel.id === selectedHotelId)?.name ?? ""
            : selectedHotelData?.name ?? ""
        );
        setAreas((areasRes.data ?? []) as AreaRow[]);
        setTemplates((templatesRes.data ?? []) as TemplateRow[]);
        setRuns((runsRes.data ?? []) as AuditRunRow[]);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar el dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [profile, selectedHotelId, canChooseHotel]);

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const r of runs) {
      if (!r.executed_at) continue;
      ys.add(new Date(r.executed_at).getFullYear());
    }
    if (ys.size === 0) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [runs]);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const thisQuarter = getCurrentQuarter();

  const monthScore   = useMemo(() => getMonthScore(runs, thisYear, thisMonth),     [runs, thisYear, thisMonth]);
  const quarterScore = useMemo(() => getQuarterScore(runs, thisYear, thisQuarter), [runs, thisYear, thisQuarter]);
  const yearScore    = useMemo(() => getYearScore(runs, thisYear),                 [runs, thisYear]);

  const monthLabels = useMemo(() => {
    return heatMode === "YEAR" ? buildMonthLabelsForYear() : buildMonthLabelsRolling12M();
  }, [heatMode]);

  const internalRuns = useMemo(
    () => runs.filter((r) => (r.audit_channel ?? "internal") === "internal"),
    [runs]
  );

  const qualityRuns = useMemo(
    () => runs.filter((r) => r.audit_channel === "quality"),
    [runs]
  );

  const runsByArea = useMemo(() => groupRunsByArea(runs), [runs]);
  const internalRunsByArea = useMemo(() => groupRunsByArea(internalRuns), [internalRuns]);
  const qualityRunsByArea = useMemo(() => groupRunsByArea(qualityRuns), [qualityRuns]);

  const templateById = useMemo(() => {
    const map = new Map<string, TemplateRow>();
    for (const template of templates) map.set(template.id, template);
    return map;
  }, [templates]);

  const areaById = useMemo(() => {
    const map = new Map<string, AreaRow>();
    for (const area of areas) map.set(area.id, area);
    return map;
  }, [areas]);

  const heatMapData = useMemo(() =>
    buildHeatRows(areas, runsByArea, templateById, heatMode, selectedYear),
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

  const { top3Areas, worst3Areas } = useMemo(() => {
    const items: AreaRankingItem[] = areas.map((a) => {
      const aruns = runsByArea.get(a.id) ?? [];
      const yr = getYearAverage(aruns, selectedYear);
      const trend = build3MonthTrendFromAreaRuns(aruns).map((p) => ({ key: p.key, avg: p.avg, count: p.count }));
      return { areaId: a.id, areaName: a.name, avg: yr.avg, count: yr.count, trend3m: trend };
    });

    const withAvg = items.filter((x) => typeof x.avg === "number");
    const top   = [...withAvg].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)).slice(0, 3);
    const worst = [...withAvg].sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999)).slice(0, 3);
    return { top3Areas: top, worst3Areas: worst };
  }, [areas, runsByArea, selectedYear]);

  const worst3Audits = useMemo(() => {
    const m = new Date();
    const y = m.getFullYear();
    const month = m.getMonth();

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

  return {
    loading,
    error,
    hotels,
    areas,
    runs,
    monthScore,
    quarterScore,
    yearScore,
    heatMapData,
    heatMapDataInternal,
    heatMapDataQuality,
    monthLabels,
    availableYears,
    top3Areas,
    worst3Areas,
    worst3Audits,
    selectedHotelName,
    canChooseHotel,
    resetForHotelChange,
  };
}
