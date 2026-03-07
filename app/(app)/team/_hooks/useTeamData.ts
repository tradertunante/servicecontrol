// FILE: app/(app)/team/_hooks/useTeamData.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const HOTEL_KEY = "sc_hotel_id";

export type TeamPeriodKey = "daily" | "weekly" | "monthly";

type Profile = {
  id: string;
  full_name: string | null;
  role: "superadmin" | "admin" | "manager" | "quality" | "auditor" | string;
};

type LeaderboardRow = {
  auditor_user_id: string;
  auditor_name: string;
  audits_done: number;
  avg_score: number | null;
  targets_total: number;
  targets_completed: number;
  remaining: number;
  progress_pct: number;
};

type TeamTargetRow = {
  target_id: string;
  auditor_user_id: string;
  auditor: string | null;
  template: string;
  target: number;
  completed: number;
  remaining: number;
  progress_pct: number;
};

type TeamRecentRunRow = {
  id: string;
  executed_at: string | null;
  score: number | null;
  audit_template_id: string;
  template_name: string | null;
  executed_by: string | null;
  auditor_name: string | null;
};

type TeamSummary = {
  totalAuditsDone: number;
  totalTargets: number;
  totalCompletedTargets: number;
  totalRemaining: number;
  globalPct: number;
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

function canAccessTeam(role: string | null | undefined) {
  return ["manager", "quality", "admin", "superadmin"].includes(role ?? "");
}

function getDateRange(period: TeamPeriodKey) {
  const now = new Date();

  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  if (period === "weekly") {
    const day = now.getDay(); // 0 domingo, 1 lunes...
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

export function useTeamData(selectedPeriod: TeamPeriodKey) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [teamTargets, setTeamTargets] = useState<TeamTargetRow[]>([]);
  const [teamRecentRuns, setTeamRecentRuns] = useState<TeamRecentRunRow[]>([]);

  const range = useMemo(() => getDateRange(selectedPeriod), [selectedPeriod]);

  const summary = useMemo<TeamSummary>(() => {
    const totalAuditsDone = leaderboard.reduce((acc, x) => acc + Number(x.audits_done ?? 0), 0);
    const totalTargets = leaderboard.reduce((acc, x) => acc + Number(x.targets_total ?? 0), 0);
    const totalCompletedTargets = leaderboard.reduce((acc, x) => acc + Number(x.targets_completed ?? 0), 0);
    const totalRemaining = leaderboard.reduce((acc, x) => acc + Number(x.remaining ?? 0), 0);
    const globalPct = totalTargets > 0 ? (totalCompletedTargets / totalTargets) * 100 : 0;

    return {
      totalAuditsDone,
      totalTargets,
      totalCompletedTargets,
      totalRemaining,
      globalPct,
    };
  }, [leaderboard]);

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
          .select("id, full_name, role")
          .eq("id", uid)
          .single();

        if (pErr) throw pErr;

        const prof = p as Profile;

        if (!canAccessTeam(prof.role)) {
          throw new Error("No tienes acceso a la vista de equipo.");
        }

        if (!cancelled) setProfile(prof);

        let areaIds: string[] = [];

        if (["admin", "superadmin", "quality"].includes(prof.role ?? "")) {
          const allAreasResp = await supabase
            .from("areas")
            .select("id")
            .eq("hotel_id", hotelId)
            .eq("active", true);

          if (allAreasResp.error) throw allAreasResp.error;

          areaIds = Array.from(new Set((allAreasResp.data ?? []).map((x: any) => x.id).filter(Boolean)));
        } else {
          const ownAreasResp = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("hotel_id", hotelId)
            .eq("user_id", uid);

          if (ownAreasResp.error) throw ownAreasResp.error;

          areaIds = Array.from(new Set((ownAreasResp.data ?? []).map((x: any) => x.area_id).filter(Boolean)));
        }

        if (areaIds.length === 0) {
          if (!cancelled) {
            setLeaderboard([]);
            setTeamTargets([]);
            setTeamRecentRuns([]);
          }
          return;
        }

        const assignmentsResp = await supabase
          .from("area_template_target_assignments")
          .select("id, area_id, audit_template_id, user_id, period, target_count, active")
          .eq("hotel_id", hotelId)
          .eq("period", selectedPeriod)
          .eq("active", true)
          .in("area_id", areaIds);

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

        if (assignments.length === 0) {
          if (!cancelled) {
            setLeaderboard([]);
            setTeamTargets([]);
            setTeamRecentRuns([]);
          }
          return;
        }

        const assignedUserIds = Array.from(new Set(assignments.map((x) => x.user_id).filter(Boolean)));
        const templateIds = Array.from(new Set(assignments.map((x) => x.audit_template_id).filter(Boolean)));

        const profilesResp = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", assignedUserIds);

        if (profilesResp.error) throw profilesResp.error;

        const profileRows = (profilesResp.data ?? []) as Profile[];
        const userNameById = Object.fromEntries(
          profileRows.map((row) => [row.id, row.full_name ?? row.id.slice(0, 8)])
        );

        const templatesResp = await supabase
          .from("audit_templates")
          .select("id, name")
          .in("id", templateIds);

        if (templatesResp.error) throw templatesResp.error;

        const templateRows = (templatesResp.data ?? []) as TemplateRow[];
        const templateNameById = Object.fromEntries(
          templateRows.map((row) => [row.id, row.name ?? "Auditoría"])
        );

        const runsResp = await supabase
          .from("audit_runs")
          .select("id, executed_at, score, audit_template_id, executed_by")
          .eq("hotel_id", hotelId)
          .in("executed_by", assignedUserIds)
          .not("executed_at", "is", null)
          .gte("executed_at", range.startISO)
          .lte("executed_at", range.endISO)
          .order("executed_at", { ascending: false });

        if (runsResp.error) throw runsResp.error;

        const runs = (runsResp.data ?? []) as any[];

        const runCountByUserTemplate: Record<string, number> = {};
        const runCountByUser: Record<string, number> = {};
        const runScoresByUser: Record<string, number[]> = {};

        for (const run of runs) {
          const runUserId = run.executed_by as string | null;
          const runTemplateId = run.audit_template_id as string | null;
          if (!runUserId || !runTemplateId) continue;

          const key = `${runUserId}__${runTemplateId}`;

          runCountByUserTemplate[key] = Number(runCountByUserTemplate[key] ?? 0) + 1;
          runCountByUser[runUserId] = Number(runCountByUser[runUserId] ?? 0) + 1;

          if (run.score !== null && run.score !== undefined && Number.isFinite(Number(run.score))) {
            if (!runScoresByUser[runUserId]) runScoresByUser[runUserId] = [];
            runScoresByUser[runUserId].push(Number(run.score));
          }
        }

        const groupedTargetsMap: Record<
          string,
          {
            auditor_user_id: string;
            auditor: string | null;
            audit_template_id: string;
            template: string;
            target: number;
            completedRaw: number;
          }
        > = {};

        for (const row of assignments) {
          const key = `${row.user_id}__${row.audit_template_id}`;

          if (!groupedTargetsMap[key]) {
            groupedTargetsMap[key] = {
              auditor_user_id: row.user_id,
              auditor: userNameById[row.user_id] ?? null,
              audit_template_id: row.audit_template_id,
              template: templateNameById[row.audit_template_id] ?? "Auditoría",
              target: 0,
              completedRaw: Number(runCountByUserTemplate[key] ?? 0),
            };
          }

          groupedTargetsMap[key].target += Number(row.target_count ?? 0);
        }

        const teamTargetRows: TeamTargetRow[] = Object.entries(groupedTargetsMap)
          .map(([key, row]) => {
            const completed = Math.min(Number(row.completedRaw ?? 0), Number(row.target ?? 0));
            const remaining = Math.max(0, Number(row.target ?? 0) - Number(completed ?? 0));
            const progressPct = Number(row.target ?? 0) > 0 ? (completed / Number(row.target)) * 100 : 0;

            return {
              target_id: key,
              auditor_user_id: row.auditor_user_id,
              auditor: row.auditor,
              template: row.template,
              target: Number(row.target ?? 0),
              completed,
              remaining,
              progress_pct: progressPct,
            };
          })
          .sort((a, b) => {
            if (a.auditor_user_id !== b.auditor_user_id) {
              return String(a.auditor ?? "").localeCompare(String(b.auditor ?? ""));
            }
            return String(a.template ?? "").localeCompare(String(b.template ?? ""));
          });

        if (!cancelled) setTeamTargets(teamTargetRows);

        const userAggMap: Record<
          string,
          {
            auditor_user_id: string;
            auditor_name: string;
            targets_total: number;
            targets_completed: number;
            remaining: number;
            audits_done: number;
            avg_score: number | null;
          }
        > = {};

        for (const row of teamTargetRows) {
          if (!userAggMap[row.auditor_user_id]) {
            const scores = runScoresByUser[row.auditor_user_id] ?? [];
            const avgScore =
              scores.length > 0 ? scores.reduce((acc, x) => acc + Number(x ?? 0), 0) / scores.length : null;

            userAggMap[row.auditor_user_id] = {
              auditor_user_id: row.auditor_user_id,
              auditor_name: row.auditor ?? row.auditor_user_id.slice(0, 8),
              targets_total: 0,
              targets_completed: 0,
              remaining: 0,
              audits_done: Number(runCountByUser[row.auditor_user_id] ?? 0),
              avg_score: avgScore,
            };
          }

          userAggMap[row.auditor_user_id].targets_total += Number(row.target ?? 0);
          userAggMap[row.auditor_user_id].targets_completed += Number(row.completed ?? 0);
          userAggMap[row.auditor_user_id].remaining += Number(row.remaining ?? 0);
        }

        const leaderboardRows: LeaderboardRow[] = Object.values(userAggMap)
          .map((row) => ({
            auditor_user_id: row.auditor_user_id,
            auditor_name: row.auditor_name,
            audits_done: row.audits_done,
            avg_score: row.avg_score,
            targets_total: row.targets_total,
            targets_completed: row.targets_completed,
            remaining: row.remaining,
            progress_pct: row.targets_total > 0 ? (row.targets_completed / row.targets_total) * 100 : 0,
          }))
          .sort((a, b) => {
            const pctDiff = Number(b.progress_pct ?? 0) - Number(a.progress_pct ?? 0);
            if (pctDiff !== 0) return pctDiff;

            const auditsDiff = Number(b.audits_done ?? 0) - Number(a.audits_done ?? 0);
            if (auditsDiff !== 0) return auditsDiff;

            return String(a.auditor_name ?? "").localeCompare(String(b.auditor_name ?? ""));
          });

        if (!cancelled) setLeaderboard(leaderboardRows);

        const mappedRuns = runs.slice(0, 20).map((r) => ({
          id: r.id,
          executed_at: r.executed_at ?? null,
          score: r.score ?? null,
          audit_template_id: r.audit_template_id,
          template_name: templateNameById[r.audit_template_id] ?? null,
          executed_by: r.executed_by ?? null,
          auditor_name: userNameById[r.executed_by] ?? null,
        })) as TeamRecentRunRow[];

        if (!cancelled) setTeamRecentRuns(mappedRuns);
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
    leaderboard,
    teamTargets,
    teamRecentRuns,
    summary,
  };
}