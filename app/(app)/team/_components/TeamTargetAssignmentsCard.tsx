// FILE: app/(app)/team/_components/TeamTargetAssignmentsCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type PeriodKey = "daily" | "weekly" | "monthly";

type AreaRow = {
  id: string;
  name: string;
};

type TeamUserRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type AreaTemplateTargetRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
  audit_templates?: {
    name: string | null;
  } | null;
};

type AssignmentRow = {
  id?: string;
  area_template_target_id?: string | null;
  user_id: string;
  target_count: number;
  active: boolean;
};

type TemplateAssignmentMap = Record<string, Record<string, AssignmentRow>>;

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

function getPeriodLabel(period: string) {
  if (period === "daily") return "diario";
  if (period === "weekly") return "semanal";
  if (period === "monthly") return "mensual";
  return period;
}

function getAssignmentStatus(targetCount: number, assignedTotal: number) {
  if (assignedTotal === targetCount) return "complete";
  if (assignedTotal < targetCount) return "pending";
  return "over_assigned";
}

function getTemplateName(row: AreaTemplateTargetRow) {
  return row.audit_templates?.name ?? "Template sin nombre";
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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("daily");

  const [teamUsers, setTeamUsers] = useState<TeamUserRow[]>([]);
  const [templateTargets, setTemplateTargets] = useState<AreaTemplateTargetRow[]>([]);
  const [assignmentsByTemplate, setAssignmentsByTemplate] = useState<TemplateAssignmentMap>({});

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  useEffect(() => {
    if (!selectedAreaId) return;
    loadAreaContext(selectedAreaId, selectedPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAreaId, selectedPeriod]);

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

  async function loadAreaContext(areaId: string, period: PeriodKey) {
    setLoading(true);
    setError(null);

    // 1) Targets por template para el área + periodo
    const targetsResp = await supabase
      .from("area_template_targets")
      .select(`
        id,
        hotel_id,
        area_id,
        audit_template_id,
        period,
        target_count,
        active,
        audit_templates(name)
      `)
      .eq("hotel_id", hotelId)
      .eq("area_id", areaId)
      .eq("period", period)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (targetsResp.error) {
      setError(targetsResp.error.message);
      setLoading(false);
      return;
    }

    const targetRows = (targetsResp.data ?? []) as AreaTemplateTargetRow[];
    setTemplateTargets(targetRows);

    // 2) Usuarios del área
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

    const areaUserIds = Array.from(new Set((uaaResp.data ?? []).map((row: any) => row.user_id).filter(Boolean)));

    const candidateUserIds = Array.from(new Set([...(areaUserIds ?? []), uid].filter(Boolean))) as string[];

    if (candidateUserIds.length === 0) {
      setTeamUsers([]);
      setAssignmentsByTemplate({});
      setLoading(false);
      return;
    }

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

    // 3) Repartos guardados por template
    const templateIds = targetRows.map((x) => x.audit_template_id).filter(Boolean);

    if (templateIds.length === 0) {
      setAssignmentsByTemplate({});
      setLoading(false);
      return;
    }

    const assResp = await supabase
      .from("area_template_target_assignments")
      .select(`
        id,
        area_template_target_id,
        area_id,
        audit_template_id,
        user_id,
        period,
        target_count,
        active
      `)
      .eq("hotel_id", hotelId)
      .eq("area_id", areaId)
      .eq("period", period)
      .in("audit_template_id", templateIds);

    if (assResp.error) {
      setError(assResp.error.message);
      setLoading(false);
      return;
    }

    const nextMap: TemplateAssignmentMap = {};

    for (const target of targetRows) {
      nextMap[target.audit_template_id] = {};
    }

    for (const row of assResp.data ?? []) {
      const auditTemplateId = (row as any).audit_template_id as string;
      const userId = (row as any).user_id as string;

      if (!nextMap[auditTemplateId]) nextMap[auditTemplateId] = {};

      nextMap[auditTemplateId][userId] = {
        id: (row as any).id,
        area_template_target_id: (row as any).area_template_target_id ?? null,
        user_id: userId,
        target_count: Number((row as any).target_count ?? 0),
        active: Boolean((row as any).active ?? true),
      };
    }

    for (const target of targetRows) {
      const templateId = target.audit_template_id;
      if (!nextMap[templateId]) nextMap[templateId] = {};

      for (const user of users) {
        if (!nextMap[templateId][user.id]) {
          nextMap[templateId][user.id] = {
            area_template_target_id: target.id,
            user_id: user.id,
            target_count: 0,
            active: true,
          };
        }
      }
    }

    setAssignmentsByTemplate(nextMap);
    setLoading(false);
  }

  function updateAssignment(templateId: string, userId: string, value: number) {
    const target = templateTargets.find((x) => x.audit_template_id === templateId);

    setAssignmentsByTemplate((prev) => ({
      ...prev,
      [templateId]: {
        ...(prev[templateId] ?? {}),
        [userId]: {
          ...(prev[templateId]?.[userId] ?? {
            user_id: userId,
            active: true,
            area_template_target_id: target?.id ?? null,
          }),
          user_id: userId,
          target_count: Number.isFinite(value) ? value : 0,
          active: true,
          area_template_target_id: prev[templateId]?.[userId]?.area_template_target_id ?? target?.id ?? null,
        },
      },
    }));
  }

  const overallSummary = useMemo(() => {
    const totalTarget = templateTargets.reduce((acc, row) => acc + Number(row.target_count ?? 0), 0);

    const totalAssigned = templateTargets.reduce((acc, row) => {
      const tplMap = assignmentsByTemplate[row.audit_template_id] ?? {};
      const tplAssigned = Object.values(tplMap).reduce((sum, x) => sum + Number(x.target_count ?? 0), 0);
      return acc + tplAssigned;
    }, 0);

    return {
      totalTarget,
      totalAssigned,
      remaining: totalTarget - totalAssigned,
      status: getAssignmentStatus(totalTarget, totalAssigned),
    };
  }, [templateTargets, assignmentsByTemplate]);

  async function saveAssignments() {
    if (!selectedAreaId) {
      setError("Selecciona un área.");
      return;
    }

    if (templateTargets.length === 0) {
      setError("Esta área no tiene objetivos por auditoría para este periodo.");
      return;
    }

    setSaving(true);
    setError(null);

    const auth = await supabase.auth.getUser();
    const createdBy = auth.data.user?.id ?? null;

    for (const target of templateTargets) {
      const templateId = target.audit_template_id;
      const templateAssignments = assignmentsByTemplate[templateId] ?? {};

      for (const row of Object.values(templateAssignments)) {
        const payload: any = {
          id: row.id ?? undefined,
          hotel_id: hotelId,
          area_id: selectedAreaId,
          area_template_target_id: row.area_template_target_id ?? target.id,
          audit_template_id: templateId,
          user_id: row.user_id,
          period: selectedPeriod,
          target_count: Number(row.target_count ?? 0),
          active: row.active,
          created_by: createdBy,
        };

        let up = await supabase
          .from("area_template_target_assignments")
          .upsert(payload, {
            onConflict: "hotel_id,area_id,audit_template_id,user_id,period",
            ignoreDuplicates: false,
          });

        if (up.error && String(up.error.message || "").includes("there is no unique or exclusion constraint")) {
          const ex = await supabase
            .from("area_template_target_assignments")
            .select("id")
            .eq("hotel_id", hotelId)
            .eq("area_id", selectedAreaId)
            .eq("audit_template_id", templateId)
            .eq("user_id", row.user_id)
            .eq("period", selectedPeriod)
            .limit(1)
            .maybeSingle();

          if (ex.error) {
            setError(ex.error.message);
            setSaving(false);
            return;
          }

          if (ex.data?.id) {
            const u = await supabase
              .from("area_template_target_assignments")
              .update(payload)
              .eq("id", ex.data.id);

            if (u.error) {
              setError(u.error.message);
              setSaving(false);
              return;
            }
          } else {
            const i = await supabase
              .from("area_template_target_assignments")
              .insert(payload);

            if (i.error) {
              setError(i.error.message);
              setSaving(false);
              return;
            }
          }
        } else if (up.error) {
          setError(up.error.message);
          setSaving(false);
          return;
        }
      }
    }

    await loadAreaContext(selectedAreaId, selectedPeriod);
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>Reparto del objetivo por auditoría</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Reparte el objetivo de cada template entre los auditores de tu equipo según el periodo seleccionado.
          </div>
        </div>

        <button
          style={btn}
          onClick={() => selectedAreaId && loadAreaContext(selectedAreaId, selectedPeriod)}
          disabled={loading || saving}
        >
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
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo</div>
            <select
              style={select}
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as PeriodKey)}
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Objetivo total</div>
            <div style={input}>{templateTargets.length ? overallSummary.totalTarget : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Asignado</div>
            <div style={input}>{templateTargets.length ? overallSummary.totalAssigned : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Pendiente</div>
            <div style={input}>{templateTargets.length ? overallSummary.remaining : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Estado</div>
            <div style={input}>{templateTargets.length ? overallSummary.status : "—"}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>
          Templates del área · periodo {getPeriodLabel(selectedPeriod)}
        </div>

        {loading ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Cargando…</div>
        ) : !selectedAreaId ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Selecciona un área.</div>
        ) : templateTargets.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>
            Esta área aún no tiene objetivos por template para este periodo. Ve primero a Admin → Objetivos de área por auditoría.
          </div>
        ) : teamUsers.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>No hay auditores asignados a esta área.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {templateTargets.map((target) => {
              const templateId = target.audit_template_id;
              const templateAssignments = assignmentsByTemplate[templateId] ?? {};

              const assignedTotal = Object.values(templateAssignments).reduce(
                (acc, row) => acc + Number(row.target_count ?? 0),
                0
              );

              const targetCount = Number(target.target_count ?? 0);
              const remaining = targetCount - assignedTotal;
              const status = getAssignmentStatus(targetCount, assignedTotal);

              return (
                <div
                  key={target.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 16,
                    padding: 14,
                    background: "rgba(0,0,0,0.12)",
                  }}
                >
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
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{getTemplateName(target)}</div>
                      <div style={{ opacity: 0.78, marginTop: 4, fontSize: 13 }}>
                        Objetivo {getPeriodLabel(selectedPeriod)} para esta auditoría.
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: 8,
                        minWidth: 320,
                        flex: 1,
                      }}
                    >
                      <div style={input}>Meta: {targetCount}</div>
                      <div style={input}>Asignado: {assignedTotal}</div>
                      <div style={input}>Pendiente: {remaining}</div>
                      <div style={input}>Estado: {status}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {teamUsers.map((user) => {
                      const row = templateAssignments[user.id] ?? {
                        user_id: user.id,
                        target_count: 0,
                        active: true,
                        area_template_target_id: target.id,
                      };

                      return (
                        <div
                          key={`${templateId}_${user.id}`}
                          style={{
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 14,
                            padding: 12,
                            background: "rgba(255,255,255,0.03)",
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
                              onChange={(e) => updateAssignment(templateId, user.id, Number(e.target.value))}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          style={btn}
          onClick={saveAssignments}
          disabled={saving || loading || !selectedAreaId || templateTargets.length === 0}
        >
          {saving ? "Guardando…" : "Guardar reparto"}
        </button>
      </div>
    </div>
  );
}