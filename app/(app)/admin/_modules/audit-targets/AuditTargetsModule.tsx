"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type AreaRow = {
  id: string;
  name: string;
  active: boolean | null;
};

type TemplateRow = {
  id: string;
  name: string;
  area_id: string | null;
};

type NameRelation = { name: string | null };
type MaybeRelation = NameRelation | NameRelation[] | null;

type AreaTemplateTargetRowRaw = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
  areas?: MaybeRelation;
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
  areas: NameRelation | null;
  audit_templates: NameRelation | null;
};

type AssignmentAgg = {
  assigned_target: number;
};

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

function getAssignmentStatus(areaTarget: number, assigned: number) {
  if (assigned === areaTarget) return "complete";
  if (assigned < areaTarget) return "pending";
  return "over_assigned";
}

function normalizeRelation(value: MaybeRelation): NameRelation | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default function AuditTargetsModule({
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

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [targets, setTargets] = useState<AreaTemplateTargetRow[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, AssignmentAgg>>({});

  // Form
  const [editId, setEditId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [period, setPeriod] = useState<string>("daily");
  const [targetCount, setTargetCount] = useState<number>(3);
  const [active, setActive] = useState<boolean>(true);

  const filteredTemplates = useMemo(() => {
    if (!areaId) return templates;
    return templates.filter((t) => t.area_id === areaId);
  }, [templates, areaId]);

  function resetForm() {
    setEditId(null);
    setAreaId("");
    setTemplateId("");
    setPeriod("daily");
    setTargetCount(3);
    setActive(true);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    // 1) Áreas del hotel
    const a = await supabase
      .from("areas")
      .select("id,name,active")
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (a.error) {
      setError(a.error.message);
      setLoading(false);
      return;
    }

    setAreas((a.data ?? []) as AreaRow[]);

    // 2) Templates del hotel
    const tpls = await supabase
      .from("audit_templates")
      .select("id,name,area_id")
      .eq("hotel_id", hotelId)
      .order("name", { ascending: true });

    if (tpls.error) {
      setError(tpls.error.message);
      setLoading(false);
      return;
    }

    setTemplates((tpls.data ?? []) as TemplateRow[]);

    // 3) Objetivos de área por template
    const tg = await supabase
      .from("area_template_targets")
      .select(`
        id,
        hotel_id,
        area_id,
        audit_template_id,
        period,
        target_count,
        active,
        areas(name),
        audit_templates(name)
      `)
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });

    if (tg.error) {
      setError(tg.error.message);
      setLoading(false);
      return;
    }

    const targetRowsRaw = (tg.data ?? []) as AreaTemplateTargetRowRaw[];

    const targetRows: AreaTemplateTargetRow[] = targetRowsRaw.map((row) => ({
      id: row.id,
      hotel_id: row.hotel_id,
      area_id: row.area_id,
      audit_template_id: row.audit_template_id,
      period: row.period,
      target_count: Number(row.target_count ?? 0),
      active: row.active,
      areas: normalizeRelation(row.areas ?? null),
      audit_templates: normalizeRelation(row.audit_templates ?? null),
    }));

    setTargets(targetRows);

    // 4) Reparto agregado desde area_template_target_assignments
    const ass = await supabase
      .from("area_template_target_assignments")
      .select("area_id, audit_template_id, period, target_count, active")
      .eq("hotel_id", hotelId)
      .eq("active", true);

    if (ass.error) {
      setError(ass.error.message);
      setLoading(false);
      return;
    }

    const agg: Record<string, AssignmentAgg> = {};
    for (const row of ass.data ?? []) {
      const r = row as {
        area_id: string;
        audit_template_id: string;
        period: string;
        target_count: number | null;
      };

      const key = `${r.area_id}__${r.audit_template_id}__${r.period}`;

      if (!agg[key]) {
        agg[key] = { assigned_target: 0 };
      }

      agg[key].assigned_target += Number(r.target_count ?? 0);
    }

    setAssignmentMap(agg);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  function startEdit(row: AreaTemplateTargetRow) {
    setEditId(row.id);
    setAreaId(row.area_id);
    setTemplateId(row.audit_template_id);
    setPeriod(row.period ?? "daily");
    setTargetCount(Number(row.target_count ?? 0) || 0);
    setActive(Boolean(row.active ?? true));
  }

  async function remove(rowId: string) {
    if (!confirm("¿Eliminar este objetivo de área por template?")) return;

    setSaving(true);
    setError(null);

    const d = await supabase.from("area_template_targets").delete().eq("id", rowId);

    if (d.error) {
      setError(d.error.message);
      setSaving(false);
      return;
    }

    await loadAll();
    resetForm();
    setSaving(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    if (!areaId) {
      setError("Selecciona un área.");
      setSaving(false);
      return;
    }

    if (!templateId) {
      setError("Selecciona un template.");
      setSaving(false);
      return;
    }

    if (!Number.isFinite(Number(targetCount)) || Number(targetCount) < 0) {
      setError("El objetivo debe ser un número válido (>= 0).");
      setSaving(false);
      return;
    }

    const selectedTemplate = templates.find((t) => t.id === templateId);
    if (selectedTemplate && selectedTemplate.area_id && selectedTemplate.area_id !== areaId) {
      setError("El template seleccionado no pertenece a esa área.");
      setSaving(false);
      return;
    }

    const auth = await supabase.auth.getUser();
    const createdBy = auth.data.user?.id ?? null;

    const payload: {
      id?: string;
      hotel_id: string;
      area_id: string;
      audit_template_id: string;
      period: string;
      target_count: number;
      active: boolean;
      created_by: string | null;
    } = {
      id: editId ?? undefined,
      hotel_id: hotelId,
      area_id: areaId,
      audit_template_id: templateId,
      period,
      target_count: Number(targetCount),
      active,
      created_by: createdBy,
    };

    const up = await supabase
      .from("area_template_targets")
      .upsert(payload, {
        onConflict: "hotel_id,area_id,audit_template_id,period",
        ignoreDuplicates: false,
      })
      .select("id")
      .maybeSingle();

    if (up.error && String(up.error.message || "").includes("there is no unique or exclusion constraint")) {
      const ex = await supabase
        .from("area_template_targets")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("area_id", areaId)
        .eq("audit_template_id", templateId)
        .eq("period", period)
        .limit(1)
        .maybeSingle();

      if (ex.error) {
        setError(ex.error.message);
        setSaving(false);
        return;
      }

      if (ex.data?.id) {
        const u = await supabase.from("area_template_targets").update(payload).eq("id", ex.data.id);
        if (u.error) {
          setError(u.error.message);
          setSaving(false);
          return;
        }
      } else {
        const i = await supabase.from("area_template_targets").insert(payload);
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

    await loadAll();
    resetForm();
    setSaving(false);
  }

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Objetivos de área por auditoría</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            El admin define cuántas veces debe realizarse cada auditoría/template dentro de un área.
          </div>
        </div>

        <button style={btn} onClick={() => loadAll()} disabled={loading || saving}>
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
        <div style={{ fontWeight: 800, marginBottom: 10 }}>
          {editId ? "Editar objetivo por auditoría" : "Crear objetivo por auditoría"}
        </div>

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
              value={areaId}
              onChange={(e) => {
                const nextAreaId = e.target.value;
                setAreaId(nextAreaId);
                setTemplateId("");
              }}
            >
              <option value="">{areas.length ? "Selecciona un área…" : "No se pudieron cargar áreas"}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Auditoría / Template</div>
            <select
              style={select}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={!areaId}
            >
              <option value="">{areaId ? "Selecciona un template…" : "Primero elige un área"}</option>
              {filteredTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo</div>
            <select style={select} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Objetivo total</div>
            <input
              style={input}
              type="number"
              min={0}
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
            />
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Activo</div>
            <select style={select} value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btn} onClick={save} disabled={saving || loading}>
            {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear objetivo"}
          </button>

          {editId ? (
            <button style={btn} onClick={resetForm} disabled={saving || loading}>
              Cancelar edición
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Objetivos configurados</div>

        {loading ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Cargando…</div>
        ) : targets.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Aún no hay objetivos configurados.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {targets.map((t) => {
              const areaName = t.areas?.name ?? t.area_id.slice(0, 8);
              const templateName = t.audit_templates?.name ?? t.audit_template_id.slice(0, 8);

              const key = `${t.area_id}__${t.audit_template_id}__${t.period}`;
              const assignedTarget = assignmentMap[key]?.assigned_target ?? 0;
              const remainingToAssign = Number(t.target_count ?? 0) - assignedTarget;
              const status = getAssignmentStatus(Number(t.target_count ?? 0), assignedTarget);

              return (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.12)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 320 }}>
                    <div style={{ fontWeight: 750 }}>
                      {areaName} · <span style={{ opacity: 0.95 }}>{templateName}</span>
                    </div>

                    <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
                      Periodo: <b>{t.period}</b> · Objetivo: <b>{t.target_count}</b> · Activo: <b>{t.active ? "sí" : "no"}</b>
                    </div>

                    <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
                      Asignado: <b>{assignedTarget}</b> · Pendiente: <b>{remainingToAssign}</b> · Estado: <b>{status}</b>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={btn} onClick={() => startEdit(t)} disabled={saving}>
                      Editar
                    </button>
                    <button style={btn} onClick={() => remove(t.id)} disabled={saving}>
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}