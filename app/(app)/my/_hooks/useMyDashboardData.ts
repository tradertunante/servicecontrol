"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type MyPeriodKey = "daily" | "weekly" | "monthly";

type Role = "superadmin" | "admin" | "manager" | "quality" | "auditor" | string;

export type MyProfile = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  email: string | null;
  active: boolean | null;
};

type HotelRow = {
  id: string;
  name: string | null;
};

type AreaRow = {
  id: string;
  name: string | null;
};

export type MyTargetRow = {
  target_id: string;
  auditor_user_id: string;
  auditor: string | null;
  template: string;
  target: number;
  completed: number;
  remaining: number;
  progress_pct: number;
};

export type RecentRunRow = {
  id: string;
  executed_at: string | null;
  score: number | null;
  audit_template_id: string;
  template_name: string | null;
};

type AssignmentRow = {
  id: string;
  area_id: string;
  audit_template_id: string;
  user_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
};

type TemplateRow = {
  id: string;
  name: string | null;
};

export type MySummary = {
  totalAuditsDone: number;
  totalTargets: number;
  totalCompletedTargets: number;
  totalRemaining: number;
  globalPct: number;
  averageScore: number | null;
};

const HOTEL_KEY = "sc_hotel_id";

function getDateRange(period: MyPeriodKey) {
  const now = new Date();

  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  if (period === "weekly") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;

    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export function useMyDashboardData(selectedPeriod: MyPeriodKey) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [hotelName, setHotelName] = useState<string | null>(null);
  const [areaNames, setAreaNames] = useState<string[]>([]);
  const [myTargets, setMyTargets] = useState<MyTargetRow[]>([]);
  const [myRecentRuns, setMyRecentRuns] = useState<RecentRunRow[]>([]);

  const range = useMemo(() => getDateRange(selectedPeriod), [selectedPeriod]);

  const summary = useMemo<MySummary>(() => {
    const totalTargets = myTargets.reduce((acc, x) => acc + Number(x.target ?? 0), 0);
    const totalCompletedTargets = myTargets.reduce((acc, x) => acc + Number(x.completed ?? 0), 0);
    const totalRemaining = myTargets.reduce((acc, x) => acc + Number(x.remaining ?? 0), 0);
    const totalAuditsDone = myRecentRuns.length;

    const scores = myRecentRuns
      .map((x) => (x.score === null || x.score === undefined ? null : Number(x.score)))
      .filter((x): x is number => x !== null && Number.isFinite(x));

    const averageScore =
      scores.length > 0 ? scores.reduce((acc, x) => acc + x, 0) / scores.length : null;

    const globalPct = totalTargets > 0 ? (totalCompletedTargets / totalTargets) * 100 : 0;

    return {
      totalAuditsDone,
      totalTargets,
      totalCompletedTargets,
      totalRemaining,
      globalPct,
      averageScore,
    };
  }, [myTargets, myRecentRuns]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const hotelId = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
        if (!hotelId) throw new Error("No hay hotel seleccionado.");

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const uid = authData.user?.id;
        if (!uid) throw new Error("No hay usuario autenticado.");

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, hotel_id, email, active")
          .eq("id", uid)
          .single();

        if (pErr) throw pErr;
        if (!cancelled) setProfile(p as MyProfile);

        const hotelResp = await supabase
          .from("hotels")
          .select("id, name")
          .eq("id", hotelId)
          .maybeSingle();

        if (hotelResp.error) throw hotelResp.error;
        if (!cancelled) {
          setHotelName(((hotelResp.data ?? null) as HotelRow | null)?.name ?? null);
        }

        const areaAccessResp = await supabase
          .from("user_area_access")
          .select("area_id")
          .eq("hotel_id", hotelId)
          .eq("user_id", uid);

        if (areaAccessResp.error) throw areaAccessResp.error;

        const areaIds = Array.from(
          new Set(
            (areaAccessResp.data ?? [])
              .map((row: any) => row.area_id as string | null)
              .filter(Boolean)
          )
        ) as string[];

        if (areaIds.length > 0) {
          const areasResp = await supabase
            .from("areas")
            .select("id, name")
            .in("id", areaIds)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true });

          if (areasResp.error) throw areasResp.error;

          if (!cancelled) {
            setAreaNames(
              ((areasResp.data ?? []) as AreaRow[])
                .map((x) => x.name ?? "Área")
                .filter(Boolean)
            );
          }
        } else if (!cancelled) {
          setAreaNames([]);
        }

        const assignmentsResp = await supabase
          .from("area_template_target_assignments")
          .select("id, area_id, audit_template_id, user_id, period, target_count, active")
          .eq("hotel_id", hotelId)
          .eq("user_id", uid)
          .eq("period", selectedPeriod)
          .eq("active", true);

        if (assignmentsResp.error) throw assignmentsResp.error;

        const assignments = ((assignmentsResp.data ?? []) as any[]).map(
          (row) =>
            ({
              id: row.id,
              area_id: row.area_id,
              audit_template_id: row.audit_template_id,
              user_id: row.user_id,
              period: row.period,
              target_count: Number(row.target_count ?? 0),
              active: row.active,
            }) as AssignmentRow
        );

        const templateIds = Array.from(
          new Set(assignments.map((x) => x.audit_template_id).filter(Boolean))
        );

        let templateNameById: Record<string, string> = {};

        if (templateIds.length > 0) {
          const templatesResp = await supabase
            .from("audit_templates")
            .select("id, name")
            .in("id", templateIds);

          if (templatesResp.error) throw templatesResp.error;

          templateNameById = Object.fromEntries(
            ((templatesResp.data ?? []) as TemplateRow[]).map((row) => [
              row.id,
              row.name ?? "Auditoría",
            ])
          );
        }

        const runsResp = await supabase
          .from("audit_runs")
          .select("id, executed_at, score, audit_template_id")
          .eq("hotel_id", hotelId)
          .eq("executed_by", uid)
          .not("executed_at", "is", null)
          .gte("executed_at", range.startISO)
          .lte("executed_at", range.endISO)
          .order("executed_at", { ascending: false });

        if (runsResp.error) throw runsResp.error;

        const runs = (runsResp.data ?? []) as any[];

        const runCountByTemplate: Record<string, number> = {};
        for (const run of runs) {
          const templateId = run.audit_template_id as string | null;
          if (!templateId) continue;
          runCountByTemplate[templateId] = Number(runCountByTemplate[templateId] ?? 0) + 1;
        }

        const groupedMap: Record<
          string,
          {
            templateId: string;
            template: string;
            target: number;
            completedRaw: number;
          }
        > = {};

        for (const row of assignments) {
          const key = row.audit_template_id;

          if (!groupedMap[key]) {
            groupedMap[key] = {
              templateId: row.audit_template_id,
              template: templateNameById[row.audit_template_id] ?? "Auditoría",
              target: 0,
              completedRaw: Number(runCountByTemplate[row.audit_template_id] ?? 0),
            };
          }

          groupedMap[key].target += Number(row.target_count ?? 0);
        }

        const targetRows: MyTargetRow[] = Object.values(groupedMap)
          .map((row) => {
            const completed = Math.min(Number(row.completedRaw ?? 0), Number(row.target ?? 0));
            const remaining = Math.max(0, Number(row.target ?? 0) - Number(completed ?? 0));
            const progressPct =
              Number(row.target ?? 0) > 0 ? (completed / Number(row.target)) * 100 : 0;

            return {
              target_id: row.templateId,
              auditor_user_id: uid,
              auditor: p?.full_name ?? null,
              template: row.template,
              target: Number(row.target ?? 0),
              completed,
              remaining,
              progress_pct: progressPct,
            };
          })
          .sort((a, b) => {
            const remDiff = Number(b.remaining ?? 0) - Number(a.remaining ?? 0);
            if (remDiff !== 0) return remDiff;
            return String(a.template ?? "").localeCompare(String(b.template ?? ""));
          });

        if (!cancelled) setMyTargets(targetRows);

        const recentRuns: RecentRunRow[] = runs.slice(0, 10).map((r) => ({
          id: r.id,
          executed_at: r.executed_at ?? null,
          score: r.score ?? null,
          audit_template_id: r.audit_template_id,
          template_name: templateNameById[r.audit_template_id] ?? "Auditoría",
        }));

        if (!cancelled) setMyRecentRuns(recentRuns);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Error inesperado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [range.endISO, range.startISO, selectedPeriod]);

  return {
    loading,
    error,
    profile,
    hotelName,
    areaNames,
    myTargets,
    myRecentRuns,
    summary,
  };
}