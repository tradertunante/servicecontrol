"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

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

type TeamTemplateProgressRow = {
  template: string;
  target: number;
  completed: number;
  remaining: number;
  progress_pct: number;
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
  template_progress?: TeamTemplateProgressRow[] | null;
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

export function useTeamData({
  selectedPeriod,
  initialHotelId,
  initialProfile,
}: {
  selectedPeriod: TeamPeriodKey;
  initialHotelId: string;
  initialProfile: Profile;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile] = useState<Profile | null>(initialProfile);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [teamTargets, setTeamTargets] = useState<TeamTargetRow[]>([]);
  const [teamRecentRuns, setTeamRecentRuns] = useState<TeamRecentRunRow[]>([]);
  const [teamTemplateProgress, setTeamTemplateProgress] = useState<TeamTemplateProgressRow[]>([]);
  const [summary, setSummary] = useState<TeamSummary>(() => emptySummary());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const hotelId = initialHotelId;
        const uid = initialProfile.id;
        const prof = initialProfile;

        if (prof.role !== "superadmin" && prof.hotel_id && prof.hotel_id !== hotelId) {
          throw new Error("Hotel ID no coincide con tu perfil.");
        }

        if (!canAccessTeam(prof.role)) {
          throw new Error("No tienes acceso a la vista de equipo.");
        }

        // NOTE: Use rpc_team_summary_v2 instead of rpc_team_summary.
        // The original RPC caused PostgREST schema cache resolution issues.
        // See docs/engineering/supabase-rpc-known-issues.md
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
          setTeamRecentRuns(
            Array.isArray(payload.recent_runs)
              ? payload.recent_runs.filter(
                  (row) => row.score !== null && row.score !== undefined && Number.isFinite(Number(row.score))
                )
              : []
          );
          setTeamTemplateProgress(
            Array.isArray(payload.template_progress) ? payload.template_progress : []
          );
          setSummary(mapRpcSummary(payload.summary));
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "No se pudo cargar Team.");
          setLeaderboard([]);
          setTeamTargets([]);
          setTeamRecentRuns([]);
          setTeamTemplateProgress([]);
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
  }, [initialHotelId, initialProfile, selectedPeriod]);

  return {
    loading,
    error,
    profile,
    leaderboard,
    teamTargets,
    teamRecentRuns,
    teamTemplateProgress,
    summary,
  };
}
