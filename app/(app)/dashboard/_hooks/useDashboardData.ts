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
  build3MonthTrendFromRuns,
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

export type HeatRow = {
  key: string;
  group: string;
  label: string;
  months: HeatCell[];
  kind: "area" | "audit";
  parentKey?: string;
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
      if (!selectedHotelId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (canChooseHotel) {
          const { data: h, error: he } = await supabase.from("hotels").select("id,name,active,status").order("name");
          if (he) throw he;
          if (!alive) return;
          setHotels((h ?? []) as any);
        }

        {
          const { data: one, error: oe } = await supabase.from("hotels").select("id,name").eq("id", selectedHotelId).single();
          if (oe) throw oe;
          if (!alive) return;
          setSelectedHotelName(one?.name ?? "");
        }

        {
          const { data: a, error: ae } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id,active")
            .eq("hotel_id", selectedHotelId)
            .eq("active", true)
            .order("name");
          if (ae) throw ae;
          if (!alive) return;
          setAreas((a ?? []) as any);
        }

        {
          const { data: t, error: te } = await supabase
            .from("audit_templates")
            .select("id,name,hotel_id")
            .or(`hotel_id.eq.${selectedHotelId},hotel_id.is.null`)
            .order("name");
          if (te) throw te;
          if (!alive) return;
          setTemplates((t ?? []) as any);
        }

        {
          const { data: r, error: re } = await supabase
            .from("audit_runs")
            .select("id,hotel_id,area_id,audit_template_id,team_member_id,executed_at,executed_by,score,status,notes")
            .eq("hotel_id", selectedHotelId);

          if (re) throw re;
          if (!alive) return;
          setRuns((r ?? []) as any);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar el dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile, selectedHotelId, canChooseHotel]);

  // years disponibles (por runs)
  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const r of runs) {
      if (!r.executed_at) continue;
      ys.add(new Date(r.executed_at).getFullYear());
    }
    if (ys.size === 0) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [runs]);

  // scores top (siempre del año actual real, para las 3 gauges de arriba)
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const thisQuarter = getCurrentQuarter();

  const monthScore = useMemo(() => getMonthScore(runs, thisYear, thisMonth), [runs, thisYear, thisMonth]);
  const quarterScore = useMemo(() => getQuarterScore(runs, thisYear, thisQuarter), [runs, thisYear, thisQuarter]);
  const yearScore = useMemo(() => getYearScore(runs, thisYear), [runs, thisYear]);

  // labels según modo
  const monthLabels = useMemo(() => {
    return heatMode === "YEAR" ? buildMonthLabelsForYear() : buildMonthLabelsRolling12M();
  }, [heatMode]);

  // ✅ heatMapData jerárquico: área (parent) + auditorías (children agrupadas por nombre)
  const heatMapData = useMemo(() => {
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

    const tplById = new Map<string, TemplateRow>();
    for (const t of templates) tplById.set(t.id, t);

    const norm = (s: string) =>
      (s ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

    const rows: HeatRow[] = [];

    for (const a of areas) {
      const areaKey = `area:${a.id}`;
      const areaRuns = runs.filter((r) => r.area_id === a.id);

      rows.push({
        key: areaKey,
        group: a.type ?? "—",
        label: a.name,
        months: buildCells(areaRuns),
        kind: "area",
      });

      const buckets = new Map<string, { name: string; runs: AuditRunRow[] }>();

      for (const r of areaRuns) {
        const tid = r.audit_template_id;
        if (!tid) continue;

        const t = tplById.get(tid);
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
        });
      }
    }

    return rows;
  }, [areas, runs, templates, heatMode, selectedYear]);

  // ✅ Rankings por ÁREA (basado en selectedYear)
  const { top3Areas, worst3Areas } = useMemo(() => {
    const items: AreaRankingItem[] = areas.map((a) => {
      const aruns = runs.filter((r) => r.area_id === a.id);
      const yr = getYearAverage(aruns, selectedYear);

      const trend = build3MonthTrendFromRuns(runs, a.id).map((p) => ({
        key: p.key,
        avg: p.avg,
        count: p.count,
      }));

      return {
        areaId: a.id,
        areaName: a.name,
        avg: yr.avg,
        count: yr.count,
        trend3m: trend,
      };
    });

    const withAvg = items.filter((x) => typeof x.avg === "number");
    const top = [...withAvg].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)).slice(0, 3);
    const worst = [...withAvg].sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999)).slice(0, 3);

    return { top3Areas: top, worst3Areas: worst };
  }, [areas, runs, selectedYear]);

  // ✅ Worst 3 audits (mes ACTUAL real)
  const worst3Audits = useMemo(() => {
    const tplById = new Map<string, TemplateRow>();
    for (const t of templates) tplById.set(t.id, t);

    const areaById = new Map<string, AreaRow>();
    for (const a of areas) areaById.set(a.id, a);

    const m = new Date();
    const y = m.getFullYear();
    const month = m.getMonth();

    const monthRuns = runs
      .filter((r) => r.executed_at)
      .filter((r) => {
        const d = new Date(r.executed_at!);
        return d.getFullYear() === y && d.getMonth() === month;
      })
      .map((r) => ({
        r,
        score: Number(r.score),
      }))
      .filter((x) => Number.isFinite(x.score));

    const worst = monthRuns
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(({ r }) => {
        const a = areaById.get(r.area_id);
        const t = tplById.get(r.audit_template_id);

        return {
          areaId: r.area_id,
          areaName: a?.name ?? "Área",
          templateId: r.audit_template_id,
          templateName: (t?.name ?? "Auditoría").trim() || "Auditoría",
          score: r.score == null ? null : Number(r.score),
          executed_at: r.executed_at ?? null,
        } as WorstAuditItem;
      });

    return worst;
  }, [runs, templates, areas]);

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