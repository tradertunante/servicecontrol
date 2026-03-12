"use client";

import { useEffect, useState } from "react";
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

type RpcTeamSummaryPayload = {
  summary?: {
    total_audits_done?: number | null;
    total_targets?: number | null;
    total_completed_targets?: number | null;
    total_remaining?: number | null;
    global_pct?: number | null;
  } | null;
  leaderboard?: LeaderboardRow[] | null;
  team_targets?: TeamTargetRow[] | null;
  recent_runs?: TeamRecentRunRow[] | null;
};

function canAccessTeam(role: string | null | undefined) {
  return ["manager", "quality", "admin", "superadmin"].includes(role ?? "");
}

function emptySummary(): TeamSummary {
  return {
    totalAuditsDone: 0,
    totalTargets: 0,
    totalCompletedTargets: 0,
    totalRemaining: 0,
    globalPct: 0,
  };
}

function mapRpcSummary(
  summary: RpcTeamSummaryPayload["summary"] | undefined | null
): TeamSummary {
  return {
    totalAuditsDone: Number(summary?.total_audits_done ?? 0),
    totalTargets: Number(summary?.total_targets ?? 0),
    totalCompletedTargets: Number(summary?.total_completed_targets ?? 0),
    totalRemaining: Number(summary?.total_remaining ?? 0),
    globalPct: Number(summary?.global_pct ?? 0),
  };
}

export function useTeamData(selectedPeriod: TeamPeriodKey) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [teamTargets, setTeamTargets] = useState<TeamTargetRow[]>([]);
  const [teamRecentRuns, setTeamRecentRuns] = useState<TeamRecentRunRow[]>([]);
  const [summary, setSummary] = useState<TeamSummary>(() => emptySummary());

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

        const { data: rpcData, error: rpcErr } = await supabase.rpc("rpc_team_summary_v2", {
          p_hotel_id: hotelId,
          p_period: selectedPeriod,
          p_user_id: uid,
        });

        if (rpcErr) throw rpcErr;

        const payload = (rpcData ?? {}) as RpcTeamSummaryPayload;

        if (!cancelled) {
          setLeaderboard(Array.isArray(payload.leaderboard) ? payload.leaderboard : []);
          setTeamTargets(Array.isArray(payload.team_targets) ? payload.team_targets : []);
          setTeamRecentRuns(Array.isArray(payload.recent_runs) ? payload.recent_runs : []);
          setSummary(mapRpcSummary(payload.summary));
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "No se pudo cargar Team.");
          setLeaderboard([]);
          setTeamTargets([]);
          setTeamRecentRuns([]);
          setSummary(emptySummary());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

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
