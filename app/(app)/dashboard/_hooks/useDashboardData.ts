// FILE: app/(app)/dashboard/_hooks/useDashboardData.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AreaRow,
  AreaScore,
  AuditRunRow,
  HotelRow,
  Profile,
  ScoreAgg,
  WorstAudit,
} from "../_lib/dashboardTypes";
import {
  getCurrentQuarter,
  getMonthScore,
  getMonthScoreForTemplate,
  getQuarterScore,
  getYearScore,
  getYearScoreForTemplate,
} from "../_lib/dashboardUtils";

export const HOTEL_KEY = "sc_hotel_id";

type UseDashboardDataArgs = {
  profile: Profile | null;
  selectedHotelId: string | null;
  setSelectedHotelId: (v: string | null) => void;
};

export function useDashboardData({ profile, selectedHotelId, setSelectedHotelId }: UseDashboardDataArgs) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);

  const [monthScore, setMonthScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [quarterScore, setQuarterScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [yearScore, setYearScore] = useState<ScoreAgg>({ avg: null, count: 0 });

  const [heatMapData, setHeatMapData] = useState<any[]>([]);
  const [top3Areas, setTop3Areas] = useState<AreaScore[]>([]);
  const [worst3Areas, setWorst3Areas] = useState<AreaScore[]>([]);
  const [worst3Audits, setWorst3Audits] = useState<WorstAudit[]>([]);

  const canChooseHotel = profile?.role === "superadmin";

  // ✅ Carga lista hoteles (solo superadmin) + hotel seleccionado (localStorage)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile) return;

      try {
        if (canChooseHotel) {
          const stored = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
          if (stored && !selectedHotelId) setSelectedHotelId(stored);

          const { data: hData, error: hErr } = await supabase
            .from("hotels")
            .select("id,name,created_at")
            .order("created_at", { ascending: false });

          if (hErr) throw hErr;

          if (!alive) return;
          setHotels((hData ?? []) as HotelRow[]);
        } else {
          // no-superadmin: hotel viene del profile
          if (!profile.hotel_id) {
            setError("Tu usuario no tiene hotel asignado.");
            setLoading(false);
            return;
          }
          if (!selectedHotelId) {
            setSelectedHotelId(profile.hotel_id);
            if (typeof window !== "undefined") localStorage.setItem(HOTEL_KEY, profile.hotel_id);
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "No se pudieron cargar hoteles.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile, canChooseHotel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Carga principal dashboard (areas, runs, agregados)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile) return;
      if (canChooseHotel && !selectedHotelId) {
        setLoading(false);
        return;
      }
      if (!selectedHotelId) return;

      setLoading(true);
      setError(null);

      try {
        const hotelIdToUse = selectedHotelId;
        const isAdminLike = profile.role === "admin" || profile.role === "manager" || profile.role === "superadmin";

        // 1) Areas
        let areasList: AreaRow[] = [];

        if (isAdminLike) {
          const { data, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id,sort_order")
            .eq("hotel_id", hotelIdToUse)
            .order("sort_order", { ascending: true, nullsFirst: false })
            .order("name", { ascending: true });

          if (aErr) throw aErr;
          areasList = (data ?? []) as AreaRow[];
        } else {
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", profile.id)
            .eq("hotel_id", hotelIdToUse);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);

          if (allowedIds.length > 0) {
            const { data: areasData, error: areasErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id,sort_order")
              .eq("hotel_id", hotelIdToUse)
              .in("id", allowedIds)
              .order("sort_order", { ascending: true, nullsFirst: false })
              .order("name", { ascending: true });

            if (areasErr) throw areasErr;
            areasList = (areasData ?? []) as AreaRow[];
          }
        }

        if (!alive) return;
        setAreas(areasList);

        const areaIds = areasList.map((a) => a.id);
        if (areaIds.length === 0) {
          setRuns([]);
          setMonthScore({ avg: null, count: 0 });
          setQuarterScore({ avg: null, count: 0 });
          setYearScore({ avg: null, count: 0 });
          setHeatMapData([]);
          setTop3Areas([]);
          setWorst3Areas([]);
          setWorst3Audits([]);
          setLoading(false);
          return;
        }

        // 2) Runs (últimos 12 meses)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const { data: runsData, error: runsErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,executed_at,area_id,audit_template_id")
          .in("area_id", areaIds)
          .eq("status", "submitted")
          .gte("executed_at", oneYearAgo.toISOString())
          .order("executed_at", { ascending: false });

        if (runsErr) throw runsErr;

        const runsList = (runsData ?? []) as AuditRunRow[];
        if (!alive) return;
        setRuns(runsList);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentQuarter = getCurrentQuarter();

        setMonthScore(getMonthScore(runsList, currentYear, currentMonth));
        setQuarterScore(getQuarterScore(runsList, currentYear, currentQuarter));
        setYearScore(getYearScore(runsList, currentYear));

        // 3) Heatmap: 12M + col Año + children por template
        const heatData: any[] = [];
        const yearNow = currentYear;

        for (const area of areasList) {
          const areaRuns = runsList.filter((r) => r.area_id === area.id);

          const months: any[] = [];
          for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const y = d.getFullYear();
            const m = d.getMonth();
            const s = getMonthScore(areaRuns, y, m);
            months.push({ value: s.avg, count: s.count });
          }

          const deptYear = getYearScore(areaRuns, yearNow);
          months.push({ value: deptYear.avg, count: deptYear.count });

          const templateIdsForArea = Array.from(new Set(areaRuns.map((r) => r.audit_template_id).filter(Boolean)));

          const templateNameById = new Map<string, string>();
          if (templateIdsForArea.length > 0) {
            const { data: tData, error: tErr } = await supabase
              .from("audit_templates")
              .select("id,name")
              .in("id", templateIdsForArea);

            if (tErr) throw tErr;
            (tData ?? []).forEach((t: any) => templateNameById.set(t.id, t.name));
          }

          const children: any[] = [];
          for (const tid of templateIdsForArea) {
            const tMonths: any[] = [];

            for (let i = 11; i >= 0; i--) {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const y = d.getFullYear();
              const m = d.getMonth();
              const s = getMonthScoreForTemplate(areaRuns, tid, y, m);
              tMonths.push({ value: s.avg, count: s.count });
            }

            const yAgg = getYearScoreForTemplate(areaRuns, tid, yearNow);
            tMonths.push({ value: yAgg.avg, count: yAgg.count });

            children.push({
              label: templateNameById.get(tid) ?? "Auditoría",
              months: tMonths,
            });
          }

          children.sort((a, b) => {
            const av = a.months?.[a.months.length - 1]?.value ?? 999;
            const bv = b.months?.[b.months.length - 1]?.value ?? 999;
            return (av ?? 999) - (bv ?? 999);
          });

          heatData.push({
            group: area.type ?? "Sin categoría",
            label: area.name,
            sort_order: area.sort_order ?? null,
            months,
            children,
          });
        }

        setHeatMapData(heatData);

        // 4) Top/Worst áreas (año actual)
        const areaScores = areasList.map((area) => {
          const areaRuns = runsList.filter((r) => r.area_id === area.id);
          const s = getYearScore(areaRuns, currentYear);
          return { id: area.id, name: area.name, score: s.avg ?? 0, count: s.count };
        });

        const withData = areaScores.filter((a) => a.count > 0);

        setTop3Areas([...withData].sort((a, b) => b.score - a.score).slice(0, 3));
        setWorst3Areas([...withData].sort((a, b) => a.score - b.score).slice(0, 3));

        // 5) Worst audits (por template promedio)
        const templateIds = Array.from(new Set(runsList.map((r) => r.audit_template_id).filter(Boolean)));

        const templateNameById = new Map<string, string>();
        if (templateIds.length > 0) {
          const { data: templatesData, error: tErr } = await supabase
            .from("audit_templates")
            .select("id,name")
            .in("id", templateIds);

          if (tErr) throw tErr;
          (templatesData ?? []).forEach((t: any) => templateNameById.set(t.id, t.name));
        }

        const templateAgg = new Map<string, { sum: number; count: number }>();
        for (const r of runsList) {
          const sc = Number(r.score);
          if (!Number.isFinite(sc) || sc < 0 || sc > 100) continue;

          const key = r.audit_template_id;
          const prev = templateAgg.get(key) ?? { sum: 0, count: 0 };
          templateAgg.set(key, { sum: prev.sum + sc, count: prev.count + 1 });
        }

        const templateAreaById = new Map<string, string>();
        for (const r of runsList) {
          if (r.audit_template_id && r.area_id && !templateAreaById.has(r.audit_template_id)) {
            templateAreaById.set(r.audit_template_id, r.area_id);
          }
        }

        const worstAudits: WorstAudit[] = Array.from(templateAgg.entries())
          .map(([id, v]) => ({
            id,
            areaId: templateAreaById.get(id) ?? "",
            name: templateNameById.get(id) ?? "Auditoría",
            avg: v.count > 0 ? v.sum / v.count : 0,
            count: v.count,
          }))
          .filter((a) => a.count > 0)
          .filter((a) => !!a.areaId)
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 3);

        setWorst3Audits(worstAudits);

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar el dashboard.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile, selectedHotelId, canChooseHotel, setSelectedHotelId]);

  const selectedHotelName = useMemo(() => {
    if (!selectedHotelId) return "Hotel";
    return hotels.find((h) => h.id === selectedHotelId)?.name ?? "Hotel";
  }, [hotels, selectedHotelId]);

  const resetForHotelChange = () => {
    setAreas([]);
    setRuns([]);
    setHeatMapData([]);
    setTop3Areas([]);
    setWorst3Areas([]);
    setWorst3Audits([]);
    setMonthScore({ avg: null, count: 0 });
    setQuarterScore({ avg: null, count: 0 });
    setYearScore({ avg: null, count: 0 });
  };

  return {
    loading,
    error,
    setError,
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