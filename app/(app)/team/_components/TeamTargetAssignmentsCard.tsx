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
  hotel_id?: string | null;
  active?: boolean | null;
};

type ViewerProfile = {
  id: string;
  role: string | null;
};

type NameRelation = {
  name: string | null;
};

type MaybeRelation = NameRelation | NameRelation[] | null;

type AreaTemplateTargetRowRaw = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
  audit_templates?: MaybeRelation;
};

type AreaTemplateTargetRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
  audit_templates: NameRelation | null;
};

type AssignmentRow = {
  id?: string;
  user_id: string;
  target_count: number;
  active: boolean;
};

type TemplateAssignmentMap = Record<string, Record<string, AssignmentRow>>;
type FeedbackState = {
  type: "success" | "info";
  text: string;
} | null;

function buildBtn(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    cursor: "pointer",
    color: "white",
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

function normalizeAssignmentValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function getAssignmentStatus(targetCount: number, assignedTotal: number, hasGoal: boolean) {
  if (!hasGoal) return "Sin objetivo";
  if (assignedTotal === 0) return "Pendiente";
  if (assignedTotal < targetCount) return "Parcial";
  if (assignedTotal === targetCount) return "Completo";
  return "Excedido";
}

function normalizeRelation(value: MaybeRelation): NameRelation | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
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
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const [managerId, setManagerId] = useState<string | null>(null);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("daily");

  const [teamUsers, setTeamUsers] = useState<TeamUserRow[]>([]);
  const [templateTargets, setTemplateTargets] = useState<AreaTemplateTargetRow[]>([]);
  const [assignmentsByTemplate, setAssignmentsByTemplate] = useState<TemplateAssignmentMap>({});
  const [initialAssignmentsByTemplate, setInitialAssignmentsByTemplate] = useState<TemplateAssignmentMap>({});

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
    setFeedback(null);

    const auth = await supabase.auth.getUser();
    const uid = auth.data.user?.id ?? null;
    setManagerId(uid);

    if (!uid) {
      setError("No hay usuario autenticado.");
      setLoading(false);
      return;
    }

    const profileResp = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", uid)
      .single();

    if (profileResp.error) {
      setError(profileResp.error.message);
      setLoading(false);
      return;
    }

    const profile = profileResp.data as ViewerProfile;
    setViewerProfile(profile);

    const canConfigure = ["manager", "quality", "admin", "superadmin"].includes(
      profile.role ?? ""
    );

    if (!canConfigure) {
      setError("No tienes permisos para configurar objetivos del equipo.");
      setLoading(false);
      return;
    }

    const areaScopeResp =
      profile.role === "manager"
        ? await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", uid)
            .eq("hotel_id", hotelId)
        : await supabase
            .from("areas")
            .select("id")
            .eq("hotel_id", hotelId)
            .eq("active", true);

    if (areaScopeResp.error) {
      setError(areaScopeResp.error.message);
      setLoading(false);
      return;
    }

    const areaIds = Array.from(
      new Set(
        (areaScopeResp.data ?? [])
          .map((row: { area_id?: string | null; id?: string | null }) => row.area_id ?? row.id)
          .filter(Boolean)
      )
    ) as string[];

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
    setFeedback(null);

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

    const targetRowsRaw = (targetsResp.data ?? []) as AreaTemplateTargetRowRaw[];

    const targetRows: AreaTemplateTargetRow[] = targetRowsRaw.map((row) => ({
      id: row.id,
      hotel_id: row.hotel_id,
      area_id: row.area_id,
      audit_template_id: row.audit_template_id,
      period: row.period,
      target_count: Number(row.target_count ?? 0),
      active: row.active,
      audit_templates: normalizeRelation(row.audit_templates ?? null),
    }));

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

    const areaUserIds = Array.from(
      new Set((uaaResp.data ?? []).map((row: any) => row.user_id).filter(Boolean))
    );

    const candidateUserIds = Array.from(new Set(areaUserIds)) as string[];

    if (candidateUserIds.length === 0) {
      setTeamUsers([]);
      setAssignmentsByTemplate({});
      setInitialAssignmentsByTemplate({});
      setLoading(false);
      return;
    }

    const profilesResp = await supabase
      .from("profiles")
      .select("id, full_name, role, hotel_id, active")
      .in("id", candidateUserIds);

    if (profilesResp.error) {
      setError(profilesResp.error.message);
      setLoading(false);
      return;
    }

    let users: TeamUserRow[] = ((profilesResp.data ?? []) as TeamUserRow[]).filter(
      (x) =>
        (x.role === "auditor" || x.role === "manager") &&
        x.active !== false &&
        (x.hotel_id ?? hotelId) === hotelId
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
      setInitialAssignmentsByTemplate({});
      setLoading(false);
      return;
    }

    const assResp = await supabase
      .from("area_template_target_assignments")
      .select(`
        id,
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
            user_id: user.id,
            target_count: 0,
            active: true,
          };
        }
      }
    }

    setAssignmentsByTemplate(nextMap);
    setInitialAssignmentsByTemplate(JSON.parse(JSON.stringify(nextMap)) as TemplateAssignmentMap);
    setLoading(false);
  }

  function updateAssignment(templateId: string, userId: string, value: number) {
    const target = templateTargets.find((x) => x.audit_template_id === templateId);
    const nextValue = normalizeAssignmentValue(value);

    setAssignmentsByTemplate((prev) => ({
      ...prev,
      [templateId]: {
        ...(prev[templateId] ?? {}),
        [userId]: {
          ...(prev[templateId]?.[userId] ?? {
            user_id: userId,
            active: true,
          }),
          user_id: userId,
          target_count: nextValue,
          active: true,
        },
      },
    }));
  }

  const overallSummary = useMemo(() => {
    const totalTarget = templateTargets.reduce(
      (acc, row) => acc + Number(row.target_count ?? 0),
      0
    );

    const totalAssigned = templateTargets.reduce((acc, row) => {
      const tplMap = assignmentsByTemplate[row.audit_template_id] ?? {};
      const tplAssigned = Object.values(tplMap).reduce(
        (sum, x) => sum + Number(x.target_count ?? 0),
        0
      );
      return acc + tplAssigned;
    }, 0);

    return {
      totalTarget,
      totalAssigned,
      remaining: Math.max(totalTarget - totalAssigned, 0),
      status: getAssignmentStatus(totalTarget, totalAssigned, templateTargets.length > 0),
    };
  }, [templateTargets, assignmentsByTemplate]);

  const changedAssignmentsByTemplate = useMemo(() => {
    const next: Record<string, AssignmentRow[]> = {};

    for (const target of templateTargets) {
      const templateId = target.audit_template_id;
      const currentRows = assignmentsByTemplate[templateId] ?? {};
      const initialRows = initialAssignmentsByTemplate[templateId] ?? {};

      next[templateId] = Object.values(currentRows).filter((row) => {
        const initialRow = initialRows[row.user_id];
        return (
          !initialRow ||
          normalizeAssignmentValue(row.target_count) !==
            normalizeAssignmentValue(initialRow.target_count) ||
          Boolean(row.active) !== Boolean(initialRow.active)
        );
      });
    }

    return next;
  }, [assignmentsByTemplate, initialAssignmentsByTemplate, templateTargets]);

  const totalChangedAssignments = useMemo(
    () =>
      Object.values(changedAssignmentsByTemplate).reduce(
        (acc, rows) => acc + rows.length,
        0
      ),
    [changedAssignmentsByTemplate]
  );

  async function saveAssignments(templateId?: string) {
    if (!selectedAreaId) {
      setError("Selecciona un área.");
      return;
    }

    if (templateTargets.length === 0) {
      setError("Esta área no tiene objetivos por auditoría para este periodo.");
      return;
    }

    if (!viewerProfile || !["manager", "quality", "admin", "superadmin"].includes(viewerProfile.role ?? "")) {
      setError("No tienes permisos para guardar esta configuración.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    const auth = await supabase.auth.getUser();
    const createdBy = auth.data.user?.id ?? null;
    const targetsToSave = templateId
      ? templateTargets.filter((target) => target.audit_template_id === templateId)
      : templateTargets;

    const changedRows = targetsToSave.flatMap(
      (target) => changedAssignmentsByTemplate[target.audit_template_id] ?? []
    );

    if (changedRows.length === 0) {
      setFeedback({ type: "info", text: "No hay cambios por guardar." });
      setSaving(false);
      return;
    }

    for (const target of targetsToSave) {
      const templateId = target.audit_template_id;
      const templateAssignments = changedAssignmentsByTemplate[templateId] ?? [];

      for (const row of templateAssignments) {
        const payload: any = {
          id: row.id ?? undefined,
          hotel_id: hotelId,
          area_id: selectedAreaId,
          audit_template_id: templateId,
          user_id: row.user_id,
          period: selectedPeriod,
          target_count: normalizeAssignmentValue(Number(row.target_count ?? 0)),
          active: row.active,
          created_by: createdBy,
        };

        const up = await supabase
          .from("area_template_target_assignments")
          .upsert(payload, {
            onConflict: "hotel_id,area_id,audit_template_id,user_id,period",
            ignoreDuplicates: false,
          });

        if (
          up.error &&
          String(up.error.message || "").includes("there is no unique or exclusion constraint")
        ) {
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
    setFeedback({
      type: "success",
      text:
        changedRows.length === 1
          ? "Se guardó 1 asignación."
          : `Se guardaron ${changedRows.length} asignaciones.`,
    });
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            Reparto del objetivo por auditoría
          </div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Reparte el objetivo de cada template entre los auditores de tu equipo según
            el periodo seleccionado.
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

      {feedback ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border:
              feedback.type === "success"
                ? "1px solid rgba(16,185,129,0.28)"
                : "1px solid rgba(255,255,255,0.14)",
            background:
              feedback.type === "success"
                ? "rgba(16,185,129,0.08)"
                : "rgba(255,255,255,0.04)",
          }}
        >
          {feedback.text}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Área</div>
            <select
              style={select}
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
            >
              <option value="">
                {areas.length ? "Selecciona un área…" : "No tienes áreas asignadas"}
              </option>
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
            <div style={input}>{selectedAreaId ? overallSummary.totalTarget : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Asignado</div>
            <div style={input}>{selectedAreaId ? overallSummary.totalAssigned : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Pendiente</div>
            <div style={input}>{selectedAreaId ? overallSummary.remaining : "—"}</div>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Estado</div>
            <div style={input}>{selectedAreaId ? overallSummary.status : "—"}</div>
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
            Esta área aún no tiene objetivos por template para este periodo. Ve primero a
            Admin → Objetivos de área por auditoría.
          </div>
        ) : teamUsers.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>
            No hay auditores asignados a esta área.
          </div>
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
              const remaining = Math.max(targetCount - assignedTotal, 0);
              const status = getAssignmentStatus(targetCount, assignedTotal, true);
              const templateChanges = changedAssignmentsByTemplate[templateId] ?? [];

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
                      <div style={{ fontSize: 16, fontWeight: 800 }}>
                        {getTemplateName(target)}
                      </div>
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
                            <div style={{ fontWeight: 750 }}>
                              {user.full_name ?? user.id.slice(0, 8)}
                            </div>
                            <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
                              Rol: <b>{user.role ?? "—"}</b>
                              {user.id === managerId ? " · tú" : ""}
                            </div>
                          </div>

                          <div>
                            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
                              Objetivo asignado
                            </div>
                            <input
                              style={input}
                              type="number"
                              min={0}
                              step={1}
                              value={row.target_count}
                              onChange={(e) =>
                                updateAssignment(
                                  templateId,
                                  user.id,
                                  Number(e.target.value)
                                )
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ opacity: 0.8, fontSize: 12.5 }}>
                      {templateChanges.length === 0
                        ? "Sin cambios pendientes en este template."
                        : `${templateChanges.length} cambio${templateChanges.length === 1 ? "" : "s"} pendiente${templateChanges.length === 1 ? "" : "s"} en este template.`}
                    </div>

                    <button
                      style={btn}
                      onClick={() => saveAssignments(templateId)}
                      disabled={saving || loading || templateChanges.length === 0}
                    >
                      {saving ? "Guardando…" : "Guardar template"}
                    </button>
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
          onClick={() => saveAssignments()}
          disabled={saving || loading || !selectedAreaId || templateTargets.length === 0}
        >
          {saving ? "Guardando…" : totalChangedAssignments > 0 ? `Guardar ${totalChangedAssignments} cambio${totalChangedAssignments === 1 ? "" : "s"}` : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
