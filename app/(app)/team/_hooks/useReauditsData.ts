// FILE: app/(app)/team/_hooks/useReauditsData.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

import type {
  AreaRow,
  EnrichedReauditRow,
  ProfileLite,
  ReauditAssignmentLogRow,
  ReauditRow,
  ReauditStats,
  ReauditTimelineItem,
  ReauditTrainingLogRow,
  TeamMemberRow,
  TemplateRow,
  TrainingInfo,
  ReassignmentInfo,
} from "../_lib/reauditTypes";

type UserAreaAccessRow = {
  user_id: string;
  area_id: string;
};

export function useReauditsData({
  profile,
  hotelId,
}: {
  profile: Profile | null;
  hotelId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnrichedReauditRow[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<ProfileLite[]>([]);
  const [auditorOptionsByAreaId, setAuditorOptionsByAreaId] = useState<
    Record<string, ProfileLite[]>
  >({});
  const [error, setError] = useState("");

  const [latestTrainingLogByRunId, setLatestTrainingLogByRunId] = useState<
    Record<string, TrainingInfo>
  >({});
  const [latestAssignmentLogByRunId, setLatestAssignmentLogByRunId] = useState<
    Record<string, ReassignmentInfo>
  >({});
  const [timelineByRunId, setTimelineByRunId] = useState<
    Record<string, ReauditTimelineItem[]>
  >({});

  const activeHotelId = hotelId || profile?.hotel_id || null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!activeHotelId) {
        setRows([]);
        setAuditorOptions([]);
        setAuditorOptionsByAreaId({});
        setLatestTrainingLogByRunId({});
        setLatestAssignmentLogByRunId({});
        setTimelineByRunId({});
        setLoading(false);
        return;
      }

      if (profile && profile.role !== "superadmin" && profile.hotel_id && profile.hotel_id !== activeHotelId) {
        setError("Hotel ID no coincide con tu perfil.");
        setLoading(false);
        return;
      }

      const { data, error: runsErr } = await supabase
        .from("audit_runs")
        .select(
          "id,hotel_id,area_id,audit_template_id,team_member_id,assigned_auditor_id,parent_audit_run_id,status,score,scheduled_for,requires_training,training_confirmed,ready_for_reaudit,blocking_issue_count,origin_type,notes,executed_at"
        )
        .eq("hotel_id", activeHotelId)
        .eq("is_reaudit", true)
        .or(
          "status.eq.pending_training,status.eq.blocked_by_non_operational,and(status.eq.draft,ready_for_reaudit.eq.true)"
        )
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .limit(200);

      if (runsErr) throw runsErr;

      const baseRows = ((data ?? []) as ReauditRow[]).filter(
        (row) =>
          row.status === "pending_training" ||
          row.status === "blocked_by_non_operational" ||
          (row.status === "draft" && row.ready_for_reaudit === true)
      );
      const runIds = baseRows.map((x) => x.id);
      const parentRunIds = Array.from(
        new Set(baseRows.map((x) => x.parent_audit_run_id).filter(Boolean))
      ) as string[];

      const areaIds = Array.from(new Set(baseRows.map((x) => x.area_id).filter(Boolean)));
      const templateIds = Array.from(
        new Set(baseRows.map((x) => x.audit_template_id).filter(Boolean))
      );
      const teamMemberIds = Array.from(
        new Set(baseRows.map((x) => x.team_member_id).filter(Boolean))
      ) as string[];
      const assignedAuditorIds = Array.from(
        new Set(baseRows.map((x) => x.assigned_auditor_id).filter(Boolean))
      ) as string[];

      const [
        areasRes,
        templatesRes,
        teamRes,
        parentRunsRes,
        assignedAuditorsRes,
        allProfilesRes,
        userAreaAccessRes,
        trainingLogsRes,
        assignmentLogsRes,
      ] = await Promise.all([
        areaIds.length
          ? supabase
              .from("areas")
              .select("id,name,type")
              .eq("hotel_id", activeHotelId)
              .in("id", areaIds)
          : Promise.resolve({ data: [] as AreaRow[], error: null }),

        templateIds.length
          ? supabase
              .from("audit_templates")
              .select("id,name")
              .eq("hotel_id", activeHotelId)
              .in("id", templateIds)
          : Promise.resolve({ data: [] as TemplateRow[], error: null }),

        teamMemberIds.length
          ? supabase
              .from("team_members")
              .select("id,full_name")
              .eq("hotel_id", activeHotelId)
              .in("id", teamMemberIds)
          : Promise.resolve({ data: [] as TeamMemberRow[], error: null }),

        parentRunIds.length
          ? supabase
              .from("audit_runs")
              .select("id,score")
              .eq("hotel_id", activeHotelId)
              .in("id", parentRunIds)
          : Promise.resolve({ data: [] as { id: string; score: number | null }[], error: null }),

        assignedAuditorIds.length
          ? supabase
              .from("profiles")
              .select("id,full_name")
              .eq("hotel_id", activeHotelId)
              .in("id", assignedAuditorIds)
          : Promise.resolve({ data: [] as ProfileLite[], error: null }),

        supabase
          .from("profiles")
          .select("id,full_name,role,hotel_id,active")
          .eq("hotel_id", activeHotelId)
          .eq("active", true)
          .in("role", ["auditor", "quality", "manager", "admin", "superadmin"]),

        areaIds.length
          ? supabase
              .from("user_area_access")
              .select("user_id,area_id")
              .eq("hotel_id", activeHotelId)
              .in("area_id", areaIds)
          : Promise.resolve({ data: [] as UserAreaAccessRow[], error: null }),

        runIds.length
          ? supabase
              .from("reaudit_training_logs")
              .select(
                "id,hotel_id,reaudit_run_id,team_member_id,confirmed_by,confirmed_at,explanation,created_at"
              )
              .eq("hotel_id", activeHotelId)
              .in("reaudit_run_id", runIds)
              .order("confirmed_at", { ascending: false })
          : Promise.resolve({ data: [] as ReauditTrainingLogRow[], error: null }),

        runIds.length
          ? supabase
              .from("reaudit_assignment_logs")
              .select(
                "id,hotel_id,reaudit_run_id,previous_auditor_id,new_auditor_id,changed_by,changed_at,reason,note,created_at"
              )
              .eq("hotel_id", activeHotelId)
              .in("reaudit_run_id", runIds)
              .order("changed_at", { ascending: false })
          : Promise.resolve({ data: [] as ReauditAssignmentLogRow[], error: null }),
      ]);

      if (areasRes.error) throw areasRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (teamRes.error) throw teamRes.error;
      if (parentRunsRes.error) throw parentRunsRes.error;
      if (assignedAuditorsRes.error) throw assignedAuditorsRes.error;
      if (allProfilesRes.error) throw allProfilesRes.error;
      if (userAreaAccessRes.error) throw userAreaAccessRes.error;
      if (trainingLogsRes.error) throw trainingLogsRes.error;
      if (assignmentLogsRes.error) throw assignmentLogsRes.error;

      const allProfiles = (allProfilesRes.data ?? []) as ProfileLite[];
      const assignedProfiles = (assignedAuditorsRes.data ?? []) as ProfileLite[];
      const mergedProfiles = [...allProfiles, ...assignedProfiles];

      const profileById = new Map<string, ProfileLite>();
      for (const p of mergedProfiles) {
        if (!profileById.has(p.id)) {
          profileById.set(p.id, p);
        }
      }

      const profileNameMap = new Map<string, string | null>();
      for (const p of mergedProfiles) {
        if (!profileNameMap.has(p.id)) {
          profileNameMap.set(p.id, p.full_name ?? null);
        }
      }

      const areaMap = new Map<string, AreaRow>();
      for (const a of (areasRes.data ?? []) as AreaRow[]) {
        areaMap.set(a.id, a);
      }

      const templateMap = new Map<string, string>();
      for (const t of (templatesRes.data ?? []) as TemplateRow[]) {
        templateMap.set(t.id, t.name);
      }

      const teamMap = new Map<string, string>();
      for (const tm of (teamRes.data ?? []) as TeamMemberRow[]) {
        teamMap.set(tm.id, tm.full_name);
      }

      const parentRunScoreMap = new Map<string, number | null>();
      for (const run of (parentRunsRes.data ?? []) as { id: string; score: number | null }[]) {
        parentRunScoreMap.set(run.id, run.score ?? null);
      }

      const enriched: EnrichedReauditRow[] = baseRows.map((row) => ({
        ...row,
        area_name: areaMap.get(row.area_id)?.name ?? null,
        area_type: areaMap.get(row.area_id)?.type ?? null,
        template_name: templateMap.get(row.audit_template_id) ?? null,
        team_member_name: row.team_member_id
          ? teamMap.get(row.team_member_id) ?? null
          : null,
        assigned_auditor_name: row.assigned_auditor_id
          ? profileNameMap.get(row.assigned_auditor_id) ?? null
          : null,
        original_audit_score: row.parent_audit_run_id
          ? parentRunScoreMap.get(row.parent_audit_run_id) ?? null
          : null,
      }));

      const options = allProfiles
        .filter((p) => !!p.id)
        .sort((a, b) =>
          (a.full_name ?? "").localeCompare(b.full_name ?? "", "es", {
            sensitivity: "base",
          })
        );

      const accessRows = (userAreaAccessRes.data ?? []) as UserAreaAccessRow[];
      const nextAuditorOptionsByAreaId: Record<string, ProfileLite[]> = {};

      for (const areaId of areaIds) {
        const allowedUserIds = Array.from(
          new Set(
            accessRows
              .filter((x) => x.area_id === areaId)
              .map((x) => x.user_id)
              .filter(Boolean)
          )
        );

        const allowedProfiles = allowedUserIds
          .map((userId) => profileById.get(userId))
          .filter(Boolean) as ProfileLite[];

        nextAuditorOptionsByAreaId[areaId] = allowedProfiles.sort((a, b) =>
          (a.full_name ?? "").localeCompare(b.full_name ?? "", "es", {
            sensitivity: "base",
          })
        );
      }

      const trainingMap: Record<string, TrainingInfo> = {};
      for (const log of (trainingLogsRes.data ?? []) as ReauditTrainingLogRow[]) {
        if (!trainingMap[log.reaudit_run_id]) {
          trainingMap[log.reaudit_run_id] = {
            confirmedAt: log.confirmed_at,
            confirmedBy: log.confirmed_by
              ? profileNameMap.get(log.confirmed_by) ?? null
              : null,
            explanation: log.explanation,
          };
        }
      }

      const assignmentMap: Record<string, ReassignmentInfo> = {};
      for (const log of (assignmentLogsRes.data ?? []) as ReauditAssignmentLogRow[]) {
        if (!assignmentMap[log.reaudit_run_id]) {
          assignmentMap[log.reaudit_run_id] = {
            changedAt: log.changed_at,
            changedBy: log.changed_by
              ? profileNameMap.get(log.changed_by) ?? null
              : null,
            previousAuditorName: log.previous_auditor_id
              ? profileNameMap.get(log.previous_auditor_id) ?? null
              : null,
            newAuditorName: profileNameMap.get(log.new_auditor_id) ?? null,
            reason: log.reason ?? "",
            note: log.note ?? "",
          };
        }
      }

      const nextTimelineByRunId: Record<string, ReauditTimelineItem[]> = {};

      for (const log of (trainingLogsRes.data ?? []) as ReauditTrainingLogRow[]) {
        if (!nextTimelineByRunId[log.reaudit_run_id]) {
          nextTimelineByRunId[log.reaudit_run_id] = [];
        }

        nextTimelineByRunId[log.reaudit_run_id].push({
          id: `training-${log.id}`,
          type: "training",
          occurredAt: log.confirmed_at,
          title: "Training confirmado",
          actorName: log.confirmed_by
            ? profileNameMap.get(log.confirmed_by) ?? null
            : null,
          detailLines: [log.explanation],
        });
      }

      for (const log of (assignmentLogsRes.data ?? []) as ReauditAssignmentLogRow[]) {
        if (!nextTimelineByRunId[log.reaudit_run_id]) {
          nextTimelineByRunId[log.reaudit_run_id] = [];
        }

        const previousName = log.previous_auditor_id
          ? profileNameMap.get(log.previous_auditor_id) ?? null
          : null;
        const nextName = profileNameMap.get(log.new_auditor_id) ?? null;

        const detailLines = [`${previousName || "—"} → ${nextName || "—"}`];

        if (log.reason?.trim()) {
          detailLines.push(`Motivo: ${log.reason.trim()}`);
        }

        if (log.note?.trim()) {
          detailLines.push(log.note.trim());
        }

        nextTimelineByRunId[log.reaudit_run_id].push({
          id: `assignment-${log.id}`,
          type: "assignment",
          occurredAt: log.changed_at,
          title: "Auditor reasignado",
          actorName: log.changed_by
            ? profileNameMap.get(log.changed_by) ?? null
            : null,
          detailLines,
        });
      }

      for (const runId of Object.keys(nextTimelineByRunId)) {
        nextTimelineByRunId[runId].sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
      }

      setRows(enriched);
      setAuditorOptions(options);
      setAuditorOptionsByAreaId(nextAuditorOptionsByAreaId);
      setLatestTrainingLogByRunId(trainingMap);
      setLatestAssignmentLogByRunId(assignmentMap);
      setTimelineByRunId(nextTimelineByRunId);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Error cargando re-auditorías.");
      setLoading(false);
    }
  }, [activeHotelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo<ReauditStats>(() => {
    let pendingTraining = 0;
    let blocked = 0;
    let ready = 0;

    for (const r of rows) {
      if (r.status === "pending_training") pendingTraining += 1;
      if (r.status === "blocked_by_non_operational") blocked += 1;
      if (r.ready_for_reaudit) ready += 1;
    }

    return {
      total: rows.length,
      pendingTraining,
      blocked,
      ready,
    };
  }, [rows]);

  return {
    loading,
    error,
    rows,
    auditorOptions,
    auditorOptionsByAreaId,
    stats,
    activeHotelId,
    loadData,
    latestTrainingLogByRunId,
    latestAssignmentLogByRunId,
    timelineByRunId,
  };
}
