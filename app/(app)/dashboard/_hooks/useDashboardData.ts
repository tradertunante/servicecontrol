"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "../_lib/dashboardTypes";

export const HOTEL_KEY = "sc_hotel_id";

type HotelRow = { id: string; name: string; active: boolean | null };
type AreaRow = { id: string; hotel_id: string; name: string; type: string | null; active: boolean | null };
type TemplateRow = { id: string; name: string; hotel_id: string | null };

type AuditRunRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  team_member_id: string | null;
  executed_by: string;
  executed_at: string;
  score: number | null;
  status: string | null;
};

type GaugeScore = { value: number; count: number };

type HeatCell = { value: number | null; count: number };
type HeatMapRow = {
  group: string; // area.type (FO/HK/F&B)
  label: string; // area.name
  rowId: string; // area.id
  months: HeatCell[];
  children?: Array<{
    label: string; // template.name
    templateId: string;
    months: HeatCell[];
  }>;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1, 0, 0, 0, 0);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function avgScore(rows: AuditRunRow[]) {
  const vals = rows.map((r) => (typeof r.score === "number" ? r.score : null)).filter((v): v is number => v !== null);
  if (vals.length === 0) return { value: 0, count: 0 };
  const sum = vals.reduce((a, b) => a + b, 0);
  return { value: sum / vals.length, count: vals.length };
}

function buildMonthWindows12MPlusYear() {
  const now = new Date();
  const windows: { from: Date; to: Date }[] = [];

  // 12 meses (incluyendo el actual)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    windows.push({
      from: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0),
      to: new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0),
    });
  }

  // Año actual como última columna
  windows.push({
    from: startOfYear(now),
    to: new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0),
  });

  return windows;
}

function calcCellsForRuns(runs: AuditRunRow[]) {
  const windows = buildMonthWindows12MPlusYear();
  const cells: HeatCell[] = windows.map(() => ({ value: null, count: 0 }));

  for (const r of runs) {
    if (typeof r.score !== "number") continue;
    const dt = new Date(r.executed_at);

    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (dt >= w.from && dt < w.to) {
        const cell = cells[i];
        const prevCount = cell.count;
        const prevVal = cell.value ?? 0;

        const newCount = prevCount + 1;
        const newVal = (prevVal * prevCount + r.score) / newCount;

        cell.count = newCount;
        cell.value = newVal;
        break;
      }
    }
  }

  return cells;
}

function buildHeatMapWithBreakdown(runs: AuditRunRow[], areas: AreaRow[], templates: TemplateRow[]) {
  const tplNameById = new Map<string, string>();
  for (const t of templates) tplNameById.set(t.id, t.name);

  // runs por area
  const runsByArea = new Map<string, AuditRunRow[]>();
  for (const r of runs) {
    if (!runsByArea.has(r.area_id)) runsByArea.set(r.area_id, []);
    runsByArea.get(r.area_id)!.push(r);
  }

  const rows: HeatMapRow[] = [];

  for (const a of areas) {
    const group = (a.type ?? "").trim() || "Sin categoría";
    const label = (a.name ?? "—").trim() || "—";
    const areaRuns = runsByArea.get(a.id) ?? [];

    // fila del área (agregado)
    const areaCells = calcCellsForRuns(areaRuns);

    // ahora children: templates que aparecen en esa área (solo los que existen en runs)
    const tplIds = Array.from(new Set(areaRuns.map((r) => r.audit_template_id).filter(Boolean)));
    const children = tplIds
      .map((tplId) => {
        const tplRuns = areaRuns.filter((r) => r.audit_template_id === tplId);
        const months = calcCellsForRuns(tplRuns);
        const name = tplNameById.get(tplId) ?? "Auditoría";
        // si nunca tiene datos (count 0 en todo), no la mostramos
        const hasAny = months.some((c) => c.count > 0);
        return hasAny ? { templateId: tplId, label: name, months } : null;
      })
      .filter(Boolean) as any[];

    // si el área no tiene datos, igual la mostramos (para que se vea la estructura)
    rows.push({
      group,
      label,
      rowId: a.id,
      months: areaCells,
      children: children.length ? children : [],
    });
  }

  // orden estable por group y label
  rows.sort((x, y) => (x.group + " " + x.label).localeCompare(y.group + " " + y.label, "es"));
  return rows;
}

export function useDashboardData({
  profile,
  selectedHotelId,
  setSelectedHotelId,
}: {
  profile: Profile | null;
  selectedHotelId: string | null;
  setSelectedHotelId: (v: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const canChooseHotel = useMemo(() => profile?.role === "superadmin", [profile?.role]);

  const selectedHotelName = useMemo(() => {
    const h = hotels.find((x) => x.id === selectedHotelId);
    return h?.name ?? "";
  }, [hotels, selectedHotelId]);

  const resetForHotelChange = () => {
    setAreas([]);
    setRuns([]);
    setTemplates([]);
    setError(null);
  };

  // hoteles
  useEffect(() => {
    let alive = true;

    async function loadHotels() {
      if (!profile) return;

      if (profile.role === "superadmin") {
        setLoading(true);
        setError(null);
        try {
          const { data, error } = await supabase.from("hotels").select("id,name,active").order("name");
          if (error) throw error;
          if (!alive) return;
          setHotels((data ?? []) as any);
        } catch (e: any) {
          if (!alive) return;
          setError(e?.message ?? "No se pudieron cargar hoteles.");
        } finally {
          if (alive) setLoading(false);
        }
      } else {
        if (profile.hotel_id) {
          setHotels([{ id: profile.hotel_id, name: "Hotel", active: true }]);
          if (!selectedHotelId) setSelectedHotelId(profile.hotel_id);
        }
      }
    }

    loadHotels();
    return () => {
      alive = false;
    };
  }, [profile, selectedHotelId, setSelectedHotelId]);

  // datos del hotel
  useEffect(() => {
    let alive = true;

    async function loadHotelData(hotelId: string) {
      setLoading(true);
      setError(null);

      try {
        const { data: aData, error: aErr } = await supabase
          .from("areas")
          .select("id,hotel_id,name,type,active")
          .eq("hotel_id", hotelId)
          .order("name", { ascending: true });
        if (aErr) throw aErr;

        const from = new Date();
        from.setMonth(from.getMonth() - 13);

        const { data: rData, error: rErr } = await supabase
          .from("audit_runs")
          .select("id,hotel_id,area_id,audit_template_id,team_member_id,executed_by,executed_at,score,status")
          .eq("hotel_id", hotelId)
          .gte("executed_at", from.toISOString())
          .order("executed_at", { ascending: false });
        if (rErr) throw rErr;

        // ojo: aquí puedes limitar SOLO a hotel_id = hotelId si tus templates son siempre por hotel
        // si usas globales + hotel: lo mantenemos así
        const { data: tData, error: tErr } = await supabase
          .from("audit_templates")
          .select("id,name,hotel_id")
          .or(`hotel_id.is.null,hotel_id.eq.${hotelId}`)
          .order("name", { ascending: true });
        if (tErr) throw tErr;

        if (!alive) return;
        setAreas((aData ?? []) as any);
        setRuns((rData ?? []) as any);
        setTemplates((tData ?? []) as any);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "No se pudieron cargar datos del hotel.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (selectedHotelId) loadHotelData(selectedHotelId);

    return () => {
      alive = false;
    };
  }, [selectedHotelId]);

  // gauges
  const monthScore: GaugeScore = useMemo(() => {
    const from = startOfMonth(new Date());
    const rows = runs.filter((r) => new Date(r.executed_at) >= from);
    return avgScore(rows);
  }, [runs]);

  const quarterScore: GaugeScore = useMemo(() => {
    const from = startOfQuarter(new Date());
    const rows = runs.filter((r) => new Date(r.executed_at) >= from);
    return avgScore(rows);
  }, [runs]);

  const yearScore: GaugeScore = useMemo(() => {
    const from = startOfYear(new Date());
    const rows = runs.filter((r) => new Date(r.executed_at) >= from);
    return avgScore(rows);
  }, [runs]);

  // ✅ heatmap con desglose real por área -> templates usados en esa área
  const heatMapData = useMemo(() => buildHeatMapWithBreakdown(runs, areas, templates), [runs, areas, templates]);

  // rankings: mantenemos compat (score + avg) por si tu UI lo usa
  const top3Areas = useMemo(() => {
    const from = startOfYear(new Date());
    const byArea = new Map<string, number[]>();

    for (const r of runs) {
      if (new Date(r.executed_at) < from) continue;
      if (typeof r.score !== "number") continue;
      if (!byArea.has(r.area_id)) byArea.set(r.area_id, []);
      byArea.get(r.area_id)!.push(r.score);
    }

    return Array.from(byArea.entries())
      .map(([area_id, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const area = areas.find((a) => a.id === area_id);
        return { area_id, areaName: area?.name ?? "—", group: area?.type ?? "", score: avg, avg, count: scores.length };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3);
  }, [runs, areas]);

  const worst3Areas = useMemo(() => {
    const from = startOfYear(new Date());
    const byArea = new Map<string, number[]>();

    for (const r of runs) {
      if (new Date(r.executed_at) < from) continue;
      if (typeof r.score !== "number") continue;
      if (!byArea.has(r.area_id)) byArea.set(r.area_id, []);
      byArea.get(r.area_id)!.push(r.score);
    }

    return Array.from(byArea.entries())
      .map(([area_id, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const area = areas.find((a) => a.id === area_id);
        return { area_id, areaName: area?.name ?? "—", group: area?.type ?? "", score: avg, avg, count: scores.length };
      })
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 3);
  }, [runs, areas]);

  const worst3Audits = useMemo(() => {
    const from = startOfMonth(new Date());
    const keyMap = new Map<string, { area_id: string; template_id: string; scores: number[] }>();

    for (const r of runs) {
      if (new Date(r.executed_at) < from) continue;
      if (typeof r.score !== "number") continue;
      const key = `${r.area_id}__${r.audit_template_id}`;
      if (!keyMap.has(key)) keyMap.set(key, { area_id: r.area_id, template_id: r.audit_template_id, scores: [] });
      keyMap.get(key)!.scores.push(r.score);
    }

    return Array.from(keyMap.values())
      .map((x) => {
        const avg = x.scores.reduce((a, b) => a + b, 0) / x.scores.length;
        const area = areas.find((a) => a.id === x.area_id);
        const tpl = templates.find((t) => t.id === x.template_id);
        return {
          area_id: x.area_id,
          template_id: x.template_id,
          areaName: area?.name ?? "—",
          templateName: tpl?.name ?? "Auditoría",
          score: avg,
          avg,
          count: x.scores.length,
        };
      })
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 3);
  }, [runs, areas, templates]);

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
    top3Areas,
    worst3Areas,
    worst3Audits,
    selectedHotelName,
    canChooseHotel,
    resetForHotelChange,
  };
}