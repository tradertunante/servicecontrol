"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: string;
  title: string | null;
  status: string | null;
  due_date: string | null;
  task_type: string | null;
};

export default function TasksPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;

    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      // Get hotel_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("hotel_id")
        .eq("id", uid)
        .maybeSingle();

      const hotelId = profile?.hotel_id;
      if (!hotelId) {
        setLoading(false);
        return;
      }

      // 1) tareas target recientes filtradas por hotel
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, task_type, created_at")
        .eq("task_type", "target")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false })
        .limit(50);

      // 2) assignments del usuario
      const taskIds = (tasks ?? []).map((t) => t.id);
      const { data: assigns } = taskIds.length
        ? await supabase.from("task_assignments").select("task_id").in("task_id", taskIds).eq("user_id", uid)
        : { data: [] as { task_id: string }[] };

      const mySet = new Set((assigns ?? []).map((a: { task_id: string }) => a.task_id));
      const my = (tasks ?? []).filter((t) => mySet.has(t.id));

      if (!cancel) setRows(my);
      if (!cancel) setLoading(false);
    })();

    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div style={{ padding: 18, width: "100%" }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Mis tareas</div>
      <div style={{ opacity: 0.8, marginTop: 6 }}>Tareas objetivo asignadas a ti.</div>

      {loading ? (
        <div style={{ marginTop: 14 }}>Cargando…</div>
      ) : rows.length === 0 ? (
        <div style={{ marginTop: 14, opacity: 0.85 }}>No tienes tareas ahora mismo.</div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: 12,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontWeight: 650 }}>{r.title ?? "Tarea"}</div>
              <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
                Estado: <b>{r.status ?? "—"}</b> · Vence: <b>{r.due_date?.slice(0, 10) ?? "—"}</b>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
