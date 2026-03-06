// FILE: app/(app)/my/_hooks/useMyDashboardData.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "superadmin" | "admin" | "manager" | "quality" | "auditor" | string;

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
};

type MyTargetRow = {
  target_id: string;
  auditor: string | null; // para manager+/team view
  template: string;
  target: number;
  completed: number;
  remaining: number;
  progress_pct: number;
};

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  task_type: string | null;
  period_key: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
};

type RecentRunRow = {
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

const HOTEL_KEY = "sc_hotel_id";

function isAuditor(role: Role) {
  return role === "auditor";
}

function isManagerPlus(role: Role) {
  return role === "manager" || role === "quality" || role === "admin" || role === "superadmin";
}

function getDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    dayISO: start.toISOString().slice(0, 10),
  };
}

export function useMyDashboardData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myTargetsToday, setMyTargetsToday] = useState<MyTargetRow[]>([]);
  const [myTargetTasks, setMyTargetTasks] = useState<TaskRow[]>([]);
  const [myRecentRuns, setMyRecentRuns] = useState<RecentRunRow[]>([]);

  const dayBounds = useMemo(() => getDayBounds(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        // 1) Usuario actual
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const uid = authData.user?.id;
        if (!uid) throw new Error("No hay usuario autenticado.");

        // 2) Perfil
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", uid)
          .single();

        if (pErr) throw pErr;

        const prof = p as Profile;
        if (!cancelled) setProfile(prof);

        const hotelId = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;

        // 3) Objetivos de hoy desde el modelo nuevo
        if (!hotelId) {
          if (!cancelled) setMyTargetsToday([]);
        } else {
          let assignments: AssignmentRow[] = [];
          let relevantUserIds: string[] = [];

          if (isAuditor(prof.role)) {
            const assignmentsResp = await supabase
              .from("area_template_target_assignments")
              .select("id, area_id, audit_template_id, user_id, period, target_count, active")
              .eq("hotel_id", hotelId)
              .eq("period", "daily")
              .eq("active", true)
              .eq("user_id", uid);

            if (assignmentsResp.error) throw assignmentsResp.error;

            assignments = ((assignmentsResp.data ?? []) as any[]).map(
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

            relevantUserIds = [uid];
          } else if (isManagerPlus(prof.role)) {
            const assignmentsResp = await supabase
              .from("area_template_target_assignments")
              .select("id, area_id, audit_template_id, user_id, period, target_count, active")
              .eq("hotel_id", hotelId)
              .eq("period", "daily")
              .eq("active", true);

            if (assignmentsResp.error) throw assignmentsResp.error;

            assignments = ((assignmentsResp.data ?? []) as any[]).map(
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

            relevantUserIds = Array.from(new Set(assignments.map((x) => x.user_id).filter(Boolean)));
          } else {
            assignments = [];
            relevantUserIds = [];
          }

          if (assignments.length === 0 || relevantUserIds.length === 0) {
            if (!cancelled) setMyTargetsToday([]);
          } else {
            const templateIds = Array.from(new Set(assignments.map((x) => x.audit_template_id).filter(Boolean)));

            // perfiles/nombres
            const profilesResp = await supabase
              .from("profiles")
              .select("id, full_name, role")
              .in("id", relevantUserIds);

            if (profilesResp.error) throw profilesResp.error;

            const userNameById = Object.fromEntries(
              ((profilesResp.data ?? []) as Profile[]).map((row) => [row.id, row.full_name ?? row.id.slice(0, 8)])
            );

            // templates/nombres
            let templateNameById: Record<string, string> = {};

            if (templateIds.length > 0) {
              const templatesResp = await supabase
                .from("audit_templates")
                .select("id, name")
                .in("id", templateIds);

              if (templatesResp.error) throw templatesResp.error;

              templateNameById = Object.fromEntries(
                ((templatesResp.data ?? []) as TemplateRow[]).map((row) => [row.id, row.name ?? "Auditoría"])
              );
            }

            // runs de hoy para progreso
            const runsResp = await supabase
              .from("audit_runs")
              .select("id, executed_at, score, audit_template_id, executed_by")
              .eq("hotel_id", hotelId)
              .in("executed_by", relevantUserIds)
              .not("executed_at", "is", null)
              .gte("executed_at", dayBounds.startISO)
              .lte("executed_at", dayBounds.endISO);

            if (runsResp.error) throw runsResp.error;

            const runs = (runsResp.data ?? []) as any[];

            const runCountByUserTemplate: Record<string, number> = {};
            for (const run of runs) {
              const runUserId = run.executed_by as string | null;
              const runTemplateId = run.audit_template_id as string | null;
              if (!runUserId || !runTemplateId) continue;

              const key = `${runUserId}__${runTemplateId}`;
              runCountByUserTemplate[key] = Number(runCountByUserTemplate[key] ?? 0) + 1;
            }

            // consolidar assignments por user+template
            const groupedMap: Record<
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

              if (!groupedMap[key]) {
                groupedMap[key] = {
                  auditor_user_id: row.user_id,
                  auditor: userNameById[row.user_id] ?? null,
                  audit_template_id: row.audit_template_id,
                  template: templateNameById[row.audit_template_id] ?? "Auditoría",
                  target: 0,
                  completedRaw: Number(runCountByUserTemplate[key] ?? 0),
                };
              }

              groupedMap[key].target += Number(row.target_count ?? 0);
            }

            const targetRows: MyTargetRow[] = Object.entries(groupedMap)
              .map(([key, row]) => {
                const completed = Math.min(Number(row.completedRaw ?? 0), Number(row.target ?? 0));
                const remaining = Math.max(0, Number(row.target ?? 0) - Number(completed ?? 0));
                const progressPct = Number(row.target ?? 0) > 0 ? (completed / Number(row.target)) * 100 : 0;

                return {
                  target_id: key,
                  auditor: isAuditor(prof.role) ? null : row.auditor,
                  template: row.template,
                  target: Number(row.target ?? 0),
                  completed,
                  remaining,
                  progress_pct: progressPct,
                };
              })
              .sort((a, b) => {
                const auditorCmp = String(a.auditor ?? "").localeCompare(String(b.auditor ?? ""));
                if (auditorCmp !== 0) return auditorCmp;
                return String(a.template ?? "").localeCompare(String(b.template ?? ""));
              });

            if (!cancelled) setMyTargetsToday(targetRows);
          }
        }

        // 4) Tareas target asignadas a mí
        const { data: assigns, error: assignsErr } = await supabase
          .from("task_assignments")
          .select("task_id, user_id")
          .eq("user_id", uid)
          .limit(100);

        if (assignsErr) throw assignsErr;

        const myTaskIds = (assigns ?? []).map((a: any) => a.task_id).filter(Boolean);

        if (myTaskIds.length === 0) {
          if (!cancelled) setMyTargetTasks([]);
        } else {
          const { data: tasks, error: tasksErr } = await supabase
            .from("tasks")
            .select("id, title, status, task_type, period_key, due_date")
            .in("id", myTaskIds)
            .eq("task_type", "target")
            .order("created_at", { ascending: false })
            .limit(20);

          if (tasksErr) throw tasksErr;

          const mapped = (tasks ?? []).map((x: any) => ({
            ...x,
            assigned_user_id: uid,
          })) as TaskRow[];

          if (!cancelled) setMyTargetTasks(mapped);
        }

        // 5) Actividad reciente propia
        const { data: runs, error: rErr } = await supabase
          .from("audit_runs")
          .select("id, executed_at, score, audit_template_id")
          .eq("executed_by", uid)
          .not("executed_at", "is", null)
          .order("executed_at", { ascending: false })
          .limit(10);

        if (rErr) throw rErr;

        const templateIds = Array.from(new Set((runs ?? []).map((r: any) => r.audit_template_id).filter(Boolean)));

        let templateNameById: Record<string, string> = {};

        if (templateIds.length) {
          const { data: tpls, error: tplsErr } = await supabase
            .from("audit_templates")
            .select("id, name")
            .in("id", templateIds);

          if (tplsErr) throw tplsErr;

          templateNameById = Object.fromEntries((tpls ?? []).map((t: any) => [t.id, t.name ?? "Auditoría"]));
        }

        const enrichedRuns = (runs ?? []).map((r: any) => ({
          ...r,
          template_name: templateNameById[r.audit_template_id] ?? null,
        })) as RecentRunRow[];

        if (!cancelled) setMyRecentRuns(enrichedRuns);
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
  }, [dayBounds.dayISO, dayBounds.endISO, dayBounds.startISO]);

  return { loading, error, profile, myTargetsToday, myTargetTasks, myRecentRuns };
}