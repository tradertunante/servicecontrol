// FILE: app/(app)/team/_components/TeamTargetAssignmentsCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type AreaRow = {
  id: string;
  name: string;
};

type TeamUserRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type AreaTargetRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
};

type AssignmentRow = {
  id?: string;
  user_id: string;
  target_count: number;
  active: boolean;
};

function buildBtn(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    cursor: "pointer",
  };
}

function buildInput(): CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
    outline: "none",
  };
}

function buildSelect(): CSSProperties {
  return buildInput();
}

export default function TeamTargetAssignmentsCard({
  card,
  hotelId,
}: {
  card: CSSProperties;
  hotelId: string;
}) {
  const btn = useMemo(() => buildBtn(), []);
  const input = useMemo(() => buildInput(), []);
  const select = useMemo(() => buildSelect(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [managerId, setManagerId] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [areaTarget, setAreaTarget] = useState<AreaTargetRow | null>(null);

  const [teamUsers, setTeamUsers] = useState<TeamUserRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AssignmentRow>>({});

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  useEffect(() => {
    if (!selectedAreaId) return;
    loadAreaContext(selectedAreaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAreaId]);

  async function loadInitial() {
    setLoading(true);
    setError(null);

    const auth = await supabase.auth.getUser();
    const uid = auth.data.user?.id ?? null;
    setManagerId(uid);

    if (!uid) {
      setError("No hay usuario autenticado.");
      setLoading(false);
      return;
    }

    // Áreas del manager en este hotel
    const a = await supabase
      .from("user_area_access")
      .select("area_id")
      .eq("user_id", uid)
      .eq("hotel_id", hotelId);

    if (a.error) {
      setError(a.error.message);
      setLoading(false);
      return;
    }

    const areaIds = Array.from(new Set((a.data ?? []).map((row: any) => row.area_id).filter(Boolean)));

    if (areaIds.length === 0) {
      setAreas([]);
      setSelectedAreaId("");
      setLoading(false);
      return;
    }

    const areaRowsResp = await supabase
      .from("areas")
      .select("id,name")
      .in("id", areaIds)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (areaRowsResp.error) {
      setError(areaRowsResp.error.message);
      setLoading(false);
      return;
    }

    const dedup = Object.values(
      ((areaRowsResp.data ?? []) as AreaRow[]).reduce((acc: Record<string, AreaRow>, row) => {
        acc[row.id] = row;
        return acc;
      }, {})
    );

    setAreas(dedup);

    if (dedup.length > 0) {
      setSelectedAreaId((prev) => prev || dedup[0].id);
    }

    setLoading(false);
  }

  async function loadAreaContext(areaId: string) {
    setLoading(true);
    setError(null);

    // 1) Objetivo del área (daily)
    const t = await supabase
      .from("area_targets")
      .select("id, hotel_id, area_id, period, target_count, active")
      .eq("hotel_id", hotelId)
      .eq("area_id", areaId)
      .eq("period", "daily")
      .maybeSingle();

    if (t.error) {
      setError(t.error.message);
      setLoading(false);
      return;
    }

    setAreaTarget((t.data as AreaTargetRow | null) ?? null);

    // 2) Miembros del equipo de esa área:
    // primero user_area_access
    const uaaResp = await supabase
      .from("user_area_access")
      .select("user_id")
      .eq("hotel_id", hotelId)
      .eq("area_id", areaId);

    if (uaaResp.error) {
      setError(uaaResp.error.message);
      setLoading(false);
      return;
    }

    const auth = await supabase.auth.getUser();
    const uid = auth.data.user?.id ?? null;

    const areaUserIds = Array.from(
      new Set((uaaResp.data ?? []).map((row: any) => row.user_id).filter(Boolean))
    );

    const candidateUserIds = Array.from(new Set([...(areaUserIds ?? []), uid].filter(Boolean))) as string[];

    if (candidateUserIds.length === 0) {
      setTeamUsers([]);
      setAssignments({});
      setLoading(false);
      return;
    }

    // luego profiles
    const profilesResp = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", candidateUserIds);

    if (profilesResp.error) {
      setError(profilesResp.error.message);
      setLoading(false);
      return;
    }

    let users: TeamUserRow[] = ((profilesResp.data ?? []) as TeamUserRow[]).filter(
      (x) => x.role === "auditor" || x.id === uid
    );

    users = Object.values(
      users.reduce((acc: Record<string, TeamUserRow>, row) => {
        acc[row.id] = row;
        return acc;
      }, {})
    );

    setTeamUsers(users);

    // 3) Reparto actual (daily)
    const ass = await supabase
      .from("area_target_assignments")
      .select("id, user_id, target_count, active")
      .eq("hotel_id", hotelId)
      .eq("area_id", areaId)
      .eq("period", "daily");

    if (ass.error) {
      setError(ass.error.message);
      setLoading(false);
      return;
    }

    const map: Record<string, AssignmentRow> = {};
    for (const row of ass.data ?? []) {
      map[(row as any).user_id] = {
        id: (row as any).id,
        user_id: (row as any).user_id,
        target_count: Number((row as any).target_count ?? 0),
        active: Boolean((row as any).active ?? true),
      };
    }

    for (const user of users) {
      if (!map[user.id]) {
        map[user.id] = {
          user_id: user.id,
          target_count: 0,
          active: true,
        };
      }
    }

    setAssignments(map);
    setLoading(false);
  }

  function updateAssignment(userId: string, value: number) {
    setAssignments((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? { user_id: userId, active: true }),
        user_id: userId,
        target_count: Number.isFinite(value) ? value : 0,
        active: true,
      },
    }));
  }

  const assignedTotal = useMemo(() => {
    return Object.values(assignments).reduce((acc, row) => acc + Number(row.target_count ?? 0), 0);
  }, [assignments]);

  const areaTargetCount = Number(areaTarget?.target_count ?? 0);
  const remainingToAssign = areaTargetCount - assignedTotal;

  const assignmentStatus = useMemo(() => {
    if (!areaTarget) return "no_area_target";
    if (assignedTotal === areaTargetCount) return "complete";
    if (assignedTotal < areaTargetCount) return "pending";
    return "over_assigned";
  }, [areaTarget, assignedTotal, areaTargetCount]);

  async function saveAssignments() {
    if (!selectedAreaId) {
      setError("Selecciona un área.");
      return;
    }

    if (!areaTarget) {
      setError("Primero debe existir un objetivo de área para esta área.");
      return;
    }

    setSaving(true);
    setError(null);

    const auth = await supabase.auth.getUser();
    const createdBy = auth.data.user?.id ?? null;

    for (const row of Object.values(assignments)) {
      const payload: any = {
        id: row.id ?? undefined,
        hotel_id: hotelId,
        area_id: selectedAreaId,
        user_id: row.user_id,
        period: "daily",
        target_count: Number(row.target_count ?? 0),
        active: row.active,
        created_by: createdBy,
      };

      const up = await supabase
        .from("area_target_assignments")
        .upsert(payload, {
          onConflict: "hotel_id,area_id,user_id,period",
          ignoreDuplicates: false,
        });

      if (up.error) {
        setError(up.error.message);
        setSaving(false);
        return;
      }
    }

    await loadAreaContext(selectedAreaId);
    setSaving(false);
  }

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Reparto del objetivo</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Reparte el objetivo del área entre los auditores de tu equipo. Este reparto se mantiene hasta que lo actualices.
          </div>
        </div>

        <button style={btn} onClick={() => selectedAreaId && loadAreaContext(selectedAreaId)} disabled={loading || saving}>
          Refrescar
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.06)",
          }}
        >
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.10)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Área</div>
            <select style={select} value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)}>
              <option value="">{areas.length ? "Selecciona un área…" : "No tienes áreas asignadas"}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Objetivo del área</div>
            <div style={input}>{areaTarget ? areaTarget.target_count : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Asignado</div>
            <div style={input}>{assignedTotal}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Pendiente</div>
            <div style={input}>{areaTarget ? remainingToAssign : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Estado</div>
            <div style={input}>{assignmentStatus}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Miembros del equipo</div>

        {loading ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Cargando…</div>
        ) : !selectedAreaId ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Selecciona un área.</div>
        ) : !areaTarget ? (
          <div style={{ padding: 12, opacity: 0.85 }}>
            Esta área aún no tiene objetivo configurado por admin. Ve primero a Admin → Objetivos de área.
          </div>
        ) : teamUsers.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>No hay auditores asignados a esta área.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {teamUsers.map((user) => {
              const row = assignments[user.id] ?? {
                user_id: user.id,
                target_count: 0,
                active: true,
              };

              return (
                <div
                  key={user.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.12)",
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 1fr) 180px",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 750 }}>{user.full_name ?? user.id.slice(0, 8)}</div>
                    <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
                      Rol: <b>{user.role ?? "—"}</b>
                      {user.id === managerId ? " · tú" : ""}
                    </div>
                  </div>

                  <div>
                    <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Objetivo asignado</div>
                    <input
                      style={input}
                      type="number"
                      min={0}
                      value={row.target_count}
                      onChange={(e) => updateAssignment(user.id, Number(e.target.value))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={btn} onClick={saveAssignments} disabled={saving || loading || !areaTarget}>
          {saving ? "Guardando…" : "Guardar reparto"}
        </button>
      </div>
    </div>
  );
}