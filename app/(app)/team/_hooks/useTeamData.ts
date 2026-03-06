// FILE: app/(app)/team/_hooks/useTeamData.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const HOTEL_KEY = "sc_hotel_id";

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

function canAccessTeam(role: string | null | undefined) {
  return ["manager", "quality", "admin", "superadmin"].includes(role ?? "");
}

export function useTeamData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [teamTargets, setTeamTargets] = useState<TeamTargetRow[]>([]);
  const [teamRecentRuns, setTeamRecentRuns] = useState<TeamRecentRunRow[]>([]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

        // 1) Leaderboard
        const { data: lb, error: lbErr } = await supabase.rpc("get_auditor_leaderboard", {
          p_hotel_id: hotelId,
          p_day: todayISO,
        });

        if (lbErr) throw lbErr;
        const leaderboardRows = (lb ?? []) as LeaderboardRow[];
        if (!cancelled) setLeaderboard(leaderboardRows);

        // 2) Targets del equipo
        const { data: targets, error: tErr } = await supabase.rpc("get_my_daily_targets_progress", {
          p_day: todayISO,
        });

        if (tErr) throw tErr;
        const teamTargetRows = (targets ?? []) as TeamTargetRow[];
        if (!cancelled) setTeamTargets(teamTargetRows);

        // 3) Actividad reciente del equipo
        const teamUserIds = Array.from(new Set(leaderboardRows.map((x) => x.auditor_user_id).filter(Boolean)));

        if (teamUserIds.length === 0) {
          if (!cancelled) setTeamRecentRuns([]);
        } else {
          const { data: runs, error: rErr } = await supabase
            .from("audit_runs")
            .select("id, executed_at, score, audit_template_id, executed_by")
            .in("executed_by", teamUserIds)
            .not("executed_at", "is", null)
            .order("executed_at", { ascending: false })
            .limit(20);

          if (rErr) throw rErr;

          const templateIds = Array.from(new Set((runs ?? []).map((r: any) => r.audit_template_id).filter(Boolean)));
          let templateNameById: Record<string, string> = {};
          if (templateIds.length) {
            const { data: tpls, error: tplsErr } = await supabase
              .from("audit_templates")
              .select("id, name")
              .in("id", templateIds);

            if (tplsErr) throw tplsErr;
            templateNameById = Object.fromEntries((tpls ?? []).map((t: any) => [t.id, t.name]));
          }

          const auditorNameById = Object.fromEntries(
            leaderboardRows.map((x) => [x.auditor_user_id, x.auditor_name])
          );

          const mappedRuns = (runs ?? []).map((r: any) => ({
            ...r,
            template_name: templateNameById[r.audit_template_id] ?? null,
            auditor_name: auditorNameById[r.executed_by] ?? null,
          })) as TeamRecentRunRow[];

          if (!cancelled) setTeamRecentRuns(mappedRuns);
        }
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
  }, [todayISO]);

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