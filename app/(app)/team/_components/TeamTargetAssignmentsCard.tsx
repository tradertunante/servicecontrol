// FILE: app/(app)/team/_components/TeamTargetAssignmentsCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import AuditLogModal from "@/components/audit/AuditLogModal";
import { postAuditLogEntries } from "@/lib/auditLogsClient";
import type { AuditLogEntryInput } from "@/lib/auditLogTypes";
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
  source_ids?: string[];
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

function buildEquitableDistribution(targetCount: number, memberCount: number) {
  if (memberCount <= 0) return [];

  const normalizedTarget = normalizeAssignmentValue(targetCount);
  const base = Math.floor(normalizedTarget / memberCount);
  const remainder = normalizedTarget % memberCount;

  return Array.from({ length: memberCount }, (_, index) =>
    base + (index < remainder ? 1 : 0)
  );
}

function buildLoadBasedDistribution(targetCount: number, currentLoads: number[]) {
  const normalizedTarget = normalizeAssignmentValue(targetCount);
  if (currentLoads.length === 0) return [];

  const nextAssignments = Array.from({ length: currentLoads.length }, () => 0);

  for (let unit = 0; unit < normalizedTarget; unit += 1) {
    let selectedIndex = 0;
    let selectedLoad = currentLoads[0] + nextAssignments[0];

    for (let index = 1; index < currentLoads.length; index += 1) {
      const candidateLoad = currentLoads[index] + nextAssignments[index];
      if (candidateLoad < selectedLoad) {
        selectedIndex = index;
        selectedLoad = candidateLoad;
      }
    }

    nextAssignments[selectedIndex] += 1;
  }

  return nextAssignments;
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
  const [historyOpen, setHistoryOpen] = useState(false);

  const [teamUsers, setTeamUsers] = useState<TeamUserRow[]>([]);
  const [templateTargets, setTemplateTargets] = useState<AreaTemplateTargetRow[]>([]);
  const [assignmentsByTemplate, setAssignmentsByTemplate] = useState<TemplateAssignmentMap>({});
  const [initialAssignmentsByTemplate, setInitialAssignmentsByTemplate] = useState<TemplateAssignmentMap>({});
  const [templateHints, setTemplateHints] = useState<Record<string, string>>({});

  function getAreaName(areaId: string) {
    return areas.find((area) => area.id === areaId)?.name ?? "Área";
  }

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
      .eq("hotel_id", hotelId)
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
      new Set((uaaResp.data ?? []).map((row: { user_id: string }) => row.user_id).filter(Boolean))
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
      .eq("hotel_id", hotelId)
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

    const eligibleUserIds = users.map((user) => user.id);

    if (eligibleUserIds.length === 0) {
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
      .eq("active", true)
      .in("user_id", eligibleUserIds)
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

    type AssRespRow = {
      id: string | null;
      audit_template_id: string;
      user_id: string;
      target_count: number;
      active: boolean | null;
    };

    for (const row of (assResp.data ?? []) as AssRespRow[]) {
      const auditTemplateId = row.audit_template_id;
      const userId = row.user_id;

      if (!nextMap[auditTemplateId]) nextMap[auditTemplateId] = {};

      const existing = nextMap[auditTemplateId][userId];
      const nextId = String(row.id ?? "");
      const nextCount = Number(row.target_count ?? 0);

      if (existing) {
        nextMap[auditTemplateId][userId] = {
          ...existing,
          target_count: normalizeAssignmentValue(existing.target_count + nextCount),
          source_ids: [...(existing.source_ids ?? []), nextId].filter(Boolean),
        };
        continue;
      }

      nextMap[auditTemplateId][userId] = {
        id: nextId || undefined,
        user_id: userId,
        target_count: normalizeAssignmentValue(nextCount),
        active: Boolean(row.active ?? true),
        source_ids: nextId ? [nextId] : [],
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
            source_ids: [],
          };
        }
      }
    }

    setAssignmentsByTemplate(nextMap);
    setInitialAssignmentsByTemplate(JSON.parse(JSON.stringify(nextMap)) as TemplateAssignmentMap);
    setTemplateHints({});
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
            source_ids: [],
          }),
          user_id: userId,
          target_count: nextValue,
          active: true,
        },
      },
    }));
    setTemplateHints((prev) => ({ ...prev, [templateId]: "" }));
  }

  function autoDistributeTemplate(templateId: string, targetCount: number) {
    if (teamUsers.length === 0) {
      setTemplateHints((prev) => ({
        ...prev,
        [templateId]: "No hay miembros elegibles para repartir este objetivo.",
      }));
      return;
    }

    const distribution = buildEquitableDistribution(targetCount, teamUsers.length);
    const currentTemplate = assignmentsByTemplate[templateId] ?? {};
    const hasChanges = teamUsers.some(
      (user, index) =>
        normalizeAssignmentValue(Number(currentTemplate[user.id]?.target_count ?? 0)) !==
        normalizeAssignmentValue(distribution[index] ?? 0)
    );

    if (!hasChanges) {
      setTemplateHints((prev) => ({
        ...prev,
        [templateId]: "El reparto ya coincide con la distribucion sugerida.",
      }));
      return;
    }

    setAssignmentsByTemplate((prev) => {
      const currentTemplate = prev[templateId] ?? {};
      const nextTemplate: Record<string, AssignmentRow> = { ...currentTemplate };

      for (const [index, user] of teamUsers.entries()) {
        nextTemplate[user.id] = {
          ...(currentTemplate[user.id] ?? {
            user_id: user.id,
            active: true,
            source_ids: [],
          }),
          user_id: user.id,
          active: true,
          target_count: distribution[index] ?? 0,
        };
      }

      return {
        ...prev,
        [templateId]: nextTemplate,
      };
    });

    setTemplateHints((prev) => ({
      ...prev,
      [templateId]: "Reparto automático aplicado. Revisa y guarda los cambios.",
    }));
  }

  function autoDistributeTemplateByLoad(templateId: string, targetCount: number) {
    if (teamUsers.length === 0) {
      setTemplateHints((prev) => ({
        ...prev,
        [templateId]: "No hay miembros elegibles para repartir este objetivo.",
      }));
      return;
    }

    const currentLoads = teamUsers.map((user) =>
      templateTargets.reduce((sum, template) => {
        if (template.audit_template_id === templateId) return sum;
        const row = assignmentsByTemplate[template.audit_template_id]?.[user.id];
        return sum + normalizeAssignmentValue(Number(row?.target_count ?? 0));
      }, 0)
    );

    const distribution = buildLoadBasedDistribution(targetCount, currentLoads);
    const currentTemplate = assignmentsByTemplate[templateId] ?? {};
    const hasChanges = teamUsers.some(
      (user, index) =>
        normalizeAssignmentValue(Number(currentTemplate[user.id]?.target_count ?? 0)) !==
        normalizeAssignmentValue(distribution[index] ?? 0)
    );

    if (!hasChanges) {
      setTemplateHints((prev) => ({
        ...prev,
        [templateId]: "El reparto ya coincide con la distribucion sugerida por carga.",
      }));
      return;
    }

    setAssignmentsByTemplate((prev) => {
      const currentTemplate = prev[templateId] ?? {};
      const nextTemplate: Record<string, AssignmentRow> = { ...currentTemplate };

      for (const [index, user] of teamUsers.entries()) {
        nextTemplate[user.id] = {
          ...(currentTemplate[user.id] ?? {
            user_id: user.id,
            active: true,
            source_ids: [],
          }),
          user_id: user.id,
          active: true,
          target_count: distribution[index] ?? 0,
        };
      }

      return {
        ...prev,
        [templateId]: nextTemplate,
      };
    });

    setTemplateHints((prev) => ({
      ...prev,
      [templateId]: "Reparto por carga aplicado. Revisa y guarda los cambios.",
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

  const templateDirtyState = useMemo(() => {
    const next: Record<
      string,
      {
        dirty: boolean;
        changedRows: AssignmentRow[];
      }
    > = {};

    for (const target of templateTargets) {
      const templateId = target.audit_template_id;
      const currentRows = assignmentsByTemplate[templateId] ?? {};
      const initialRows = initialAssignmentsByTemplate[templateId] ?? {};
      const changedRows: AssignmentRow[] = [];

      for (const user of teamUsers) {
        const currentRow = currentRows[user.id] ?? {
          user_id: user.id,
          target_count: 0,
          active: true,
          source_ids: [],
        };
        const initialRow = initialRows[user.id] ?? {
          user_id: user.id,
          target_count: 0,
          active: true,
          source_ids: [],
        };

        const currentValue = normalizeAssignmentValue(Number(currentRow.target_count ?? 0));
        const initialValue = normalizeAssignmentValue(Number(initialRow.target_count ?? 0));

        if (
          currentValue !== initialValue ||
          Boolean(currentRow.active) !== Boolean(initialRow.active)
        ) {
          changedRows.push({
            ...currentRow,
            target_count: currentValue,
          });
        }
      }

      next[templateId] = {
        dirty: changedRows.length > 0,
        changedRows,
      };
    }

    return next;
  }, [assignmentsByTemplate, initialAssignmentsByTemplate, templateTargets, teamUsers]);

  const totalChangedAssignments = useMemo(
    () =>
      Object.values(templateDirtyState).reduce(
        (acc, entry) => acc + entry.changedRows.length,
        0
      ),
    [templateDirtyState]
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
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      setError("Sesión inválida.");
      setSaving(false);
      return;
    }
    const logEntries: AuditLogEntryInput[] = [];
    const targetsToSave = templateId
      ? templateTargets.filter((target) => target.audit_template_id === templateId)
      : templateTargets;

    const changedRows = targetsToSave.flatMap(
      (target) => templateDirtyState[target.audit_template_id]?.changedRows ?? []
    );

    if (changedRows.length === 0) {
      setFeedback({ type: "info", text: "No hay cambios por guardar." });
      setSaving(false);
      return;
    }

    const saveResponse = await fetch("/api/team/target-assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        area_id: selectedAreaId,
        period: selectedPeriod,
        templates: targetsToSave.map((target) => ({
          audit_template_id: target.audit_template_id,
          rows: templateDirtyState[target.audit_template_id]?.changedRows ?? [],
        })),
      }),
    });

    const savePayload = await saveResponse.json().catch(() => null);
    if (!saveResponse.ok) {
      setError(savePayload?.error ?? "No se pudo guardar la configuración.");
      setSaving(false);
      return;
    }

    for (const target of targetsToSave) {
      const templateId = target.audit_template_id;
      const templateAssignments = templateDirtyState[templateId]?.changedRows ?? [];

      for (const row of templateAssignments) {
        const normalizedTargetCount = normalizeAssignmentValue(Number(row.target_count ?? 0));
        const oldRow = initialAssignmentsByTemplate[templateId]?.[row.user_id];
        const oldTargetCount = normalizeAssignmentValue(Number(oldRow?.target_count ?? 0));
        const action =
          oldTargetCount === 0 && normalizedTargetCount > 0
            ? "assign"
            : oldTargetCount > 0 && normalizedTargetCount === 0
              ? "unassign"
              : "update";

        if (oldTargetCount !== normalizedTargetCount) {
          const userName =
            teamUsers.find((user) => user.id === row.user_id)?.full_name ??
            row.user_id.slice(0, 8);
          logEntries.push({
            hotel_id: hotelId,
            actor_user_id: createdBy,
            entity_type: "team_target_assignment",
            entity_id: `${hotelId}:${selectedAreaId}:${selectedPeriod}:${templateId}:${row.user_id}`,
            action,
            old_value:
              oldTargetCount > 0
                ? { target_count: oldTargetCount, active: oldRow?.active ?? true }
                : null,
            new_value: { target_count: normalizedTargetCount, active: row.active },
            metadata: {
              area_id: selectedAreaId,
              area_name: getAreaName(selectedAreaId),
              audit_template_id: templateId,
              template_name: getTemplateName(target),
              affected_user_id: row.user_id,
              affected_user_name: userName,
              period: selectedPeriod,
              source_screen: "team_progress",
            },
          });
        }
      }
    }

    try {
      await postAuditLogEntries(logEntries);
    } catch (auditError) {
      console.error("No se pudo registrar el historial de asignaciones", auditError);
    }

    await loadAreaContext(selectedAreaId, selectedPeriod);
    if (templateId) {
      setTemplateHints((prev) => ({ ...prev, [templateId]: "" }));
    }
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            style={btn}
            onClick={() => selectedAreaId && loadAreaContext(selectedAreaId, selectedPeriod)}
            disabled={loading || saving}
          >
            Refrescar
          </button>
          <button style={btn} onClick={() => setHistoryOpen(true)} disabled={!selectedAreaId}>
            Historial
          </button>
        </div>
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
              const templateDirty = templateDirtyState[templateId]?.dirty ?? false;
              const templateHint = templateHints[templateId] ?? "";

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

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        style={btn}
                        onClick={() => autoDistributeTemplate(templateId, targetCount)}
                        disabled={saving || loading || teamUsers.length === 0}
                      >
                        Auto-repartir
                      </button>
                      <button
                        style={btn}
                        onClick={() => autoDistributeTemplateByLoad(templateId, targetCount)}
                        disabled={saving || loading || teamUsers.length === 0}
                      >
                        Auto-repartir por carga
                      </button>
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
                      <div style={input}>Asignado: {assignedTotal} / {targetCount}</div>
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
                      {templateDirty
                        ? "Cambios sin guardar"
                        : templateHint || "Sin cambios pendientes en este template."}
                    </div>

                    <button
                      style={btn}
                      onClick={() => saveAssignments(templateId)}
                      disabled={saving || loading || !templateDirty}
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

      <AuditLogModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        hotelId={hotelId}
        entityTypes={["team_target_assignment"]}
        areaId={selectedAreaId || undefined}
        period={selectedPeriod}
        sourceScreen="team_progress"
      />
    </div>
  );
}
