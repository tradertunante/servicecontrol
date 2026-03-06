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
  auditor: string | null; // ✅ para manager/quality/admin/superadmin
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

const HOTEL_KEY = "sc_hotel_id";

function isAuditor(role: Role) {
  return role === "auditor";
}

function isManagerPlus(role: Role) {
  return role === "manager" || role === "quality" || role === "admin" || role === "superadmin";
}

export function useMyDashboardData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myTargetsToday, setMyTargetsToday] = useState<MyTargetRow[]>([]);
  const [myTargetTasks, setMyTargetTasks] = useState<TaskRow[]>([]);
  const [myRecentRuns, setMyRecentRuns] = useState<RecentRunRow[]>([]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

        // 3) Targets de hoy (según rol)
        if (isAuditor(prof.role)) {
          // ✅ auditor: solo sus objetivos
          const { data: targets, error: tErr } = await supabase.rpc("get_my_daily_targets_progress", {
            p_day: todayISO,
          });
          if (tErr) throw tErr;

          if (!cancelled) setMyTargetsToday((targets ?? []) as MyTargetRow[]);
        } else if (isManagerPlus(prof.role)) {
          // ✅ manager+ : objetivos del equipo (por hotel)
          const hotelId = localStorage.getItem(HOTEL_KEY);
          if (!hotelId) {
            if (!cancelled) setMyTargetsToday([]);
          } else {
            const { data: targets, error: tErr } = await supabase.rpc("get_hotel_daily_targets_progress", {
              p_hotel_id: hotelId,
              p_day: todayISO,
            });
            if (tErr) throw tErr;

            // la RPC devuelve auditor + template, lo guardamos en el mismo estado
            if (!cancelled) setMyTargetsToday((targets ?? []) as MyTargetRow[]);
          }
        } else {
          // otros roles raros/custom
          if (!cancelled) setMyTargetsToday([]);
        }

        // 4) Tareas "target" asignadas a mí (primero assignments, luego tasks)
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

        // 5) Actividad reciente:
        // - auditor: sus auditorías
        // - manager+: también dejamos “las suyas” (cero si no ejecuta). Luego si quieres, lo cambiamos a “equipo”.
        const { data: runs, error: rErr } = await supabase
          .from("audit_runs")
          .select("id, executed_at, score, audit_template_id")
          .eq("executed_by", uid)
          .not("executed_at", "is", null)
          .order("executed_at", { ascending: false })
          .limit(10);

        if (rErr) throw rErr;

        // Nombre del template (2 pasos robusto)
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
  }, [todayISO]);

  return { loading, error, profile, myTargetsToday, myTargetTasks, myRecentRuns };
}