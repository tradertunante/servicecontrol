// FILE: app/(app)/team/_hooks/useTeamData.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

const HOTEL_KEY = "sc_hotel_id";

export type TeamPeriodKey = "daily" | "weekly" | "monthly";

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
    const totalCompletedTargets = leaderboard.reduce(
      (acc, x) => acc + Number(x.targets_completed ?? 0),
      0
    );
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
          .select("id, full_name, role, hotel_id, active")
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

          areaIds = Array.from(
            new Set((allAreasResp.data ?? []).map((x: any) => x.id).filter(Boolean))
          );
        } else {
          const ownAreasResp = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("hotel_id", hotelId)
            .eq("user_id", uid);

          if (ownAreasResp.error) throw ownAreasResp.error;

          areaIds = Array.from(
            new Set((ownAreasResp.data ?? []).map((x: any) => x.area_id).filter(Boolean))
          );
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
        const templateIds = Array.from(
          new Set(assignments.map((x) => x.audit_template_id).filter(Boolean))
        );

        const profilesResp = await supabase
          .from("profiles")
          .select("id, full_name, role, hotel_id, active")
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
          const executedBy = run.executed_by as string | null;
          const templateId = run.audit_template_id as string | null;
          const score = typeof run.score === "number" ? run.score : Number(run.score ?? NaN);

          if (!executedBy) continue;

          const key = `${executedBy}__${templateId ?? "unknown"}`;
          runCountByUserTemplate[key] = (runCountByUserTemplate[key] ?? 0) + 1;
          runCountByUser[executedBy] = (runCountByUser[executedBy] ?? 0) + 1;

          if (Number.isFinite(score)) {
            if (!runScoresByUser[executedBy]) runScoresByUser[executedBy] = [];
            runScoresByUser[executedBy].push(score);
          }
        }

        const teamTargetsRows: TeamTargetRow[] = assignments.map((a) => {
          const completed = runCountByUserTemplate[`${a.user_id}__${a.audit_template_id}`] ?? 0;
          const remaining = Math.max(0, a.target_count - completed);
          const progressPct = a.target_count > 0 ? (completed / a.target_count) * 100 : 0;

          return {
            target_id: a.id,
            auditor_user_id: a.user_id,
            auditor: userNameById[a.user_id] ?? null,
            template: templateNameById[a.audit_template_id] ?? "Auditoría",
            target: a.target_count,
            completed,
            remaining,
            progress_pct: progressPct,
          };
        });

        const leaderboardMap = new Map<string, LeaderboardRow>();

        for (const a of assignments) {
          const existing = leaderboardMap.get(a.user_id);

          if (!existing) {
            const scores = runScoresByUser[a.user_id] ?? [];
            const avgScore =
              scores.length > 0
                ? scores.reduce((acc, n) => acc + n, 0) / scores.length
                : null;

            leaderboardMap.set(a.user_id, {
              auditor_user_id: a.user_id,
              auditor_name: userNameById[a.user_id] ?? a.user_id.slice(0, 8),
              audits_done: runCountByUser[a.user_id] ?? 0,
              avg_score: avgScore,
              targets_total: a.target_count,
              targets_completed:
                runCountByUserTemplate[`${a.user_id}__${a.audit_template_id}`] ?? 0,
              remaining: Math.max(
                0,
                a.target_count -
                  (runCountByUserTemplate[`${a.user_id}__${a.audit_template_id}`] ?? 0)
              ),
              progress_pct:
                a.target_count > 0
                  ? ((runCountByUserTemplate[`${a.user_id}__${a.audit_template_id}`] ?? 0) /
                      a.target_count) *
                    100
                  : 0,
            });
          } else {
            const completedForThisTemplate =
              runCountByUserTemplate[`${a.user_id}__${a.audit_template_id}`] ?? 0;

            existing.targets_total += a.target_count;
            existing.targets_completed += completedForThisTemplate;
            existing.remaining += Math.max(0, a.target_count - completedForThisTemplate);
            existing.progress_pct =
              existing.targets_total > 0
                ? (existing.targets_completed / existing.targets_total) * 100
                : 0;
          }
        }

        const leaderboardRows = Array.from(leaderboardMap.values()).sort((a, b) => {
          const pctDiff = (b.progress_pct ?? 0) - (a.progress_pct ?? 0);
          if (pctDiff !== 0) return pctDiff;
          return (b.audits_done ?? 0) - (a.audits_done ?? 0);
        });

        const recentRunsRows: TeamRecentRunRow[] = runs.slice(0, 12).map((run) => ({
          id: run.id,
          executed_at: run.executed_at ?? null,
          score: typeof run.score === "number" ? run.score : Number(run.score ?? null),
          audit_template_id: run.audit_template_id,
          template_name: templateNameById[run.audit_template_id] ?? null,
          executed_by: run.executed_by ?? null,
          auditor_name: userNameById[run.executed_by] ?? null,
        }));

        if (!cancelled) {
          setLeaderboard(leaderboardRows);
          setTeamTargets(teamTargetsRows);
          setTeamRecentRuns(recentRunsRows);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "No se pudo cargar Team.");
          setLeaderboard([]);
          setTeamTargets([]);
          setTeamRecentRuns([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedPeriod, range.startISO, range.endISO]);

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