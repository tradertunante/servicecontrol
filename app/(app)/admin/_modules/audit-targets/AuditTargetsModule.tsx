"use client";

import { useEffect, useMemo, useState } from "react";
import AuditLogModal from "@/components/audit/AuditLogModal";
import { postAuditLogEntries } from "@/lib/auditLogsClient";
import type { AuditLogEntryInput } from "@/lib/auditLogTypes";
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

const PERIOD_LABELS: Record<string, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
};

const STATUS_STYLES: Record<string, string> = {
  complete: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  over_assigned: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  complete: "Completo",
  pending: "Pendiente",
  over_assigned: "Excedido",
};

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

export default function AuditTargetsModule({ hotelId }: { hotelId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [targets, setTargets] = useState<AreaTemplateTargetRow[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, AssignmentAgg>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

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

  function getAreaName(areaIdValue: string) {
    return areas.find((area) => area.id === areaIdValue)?.name ?? "Área";
  }

  function getTemplateName(templateIdValue: string) {
    return templates.find((template) => template.id === templateIdValue)?.name ?? "Template";
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [a, tpls, tg, ass] = await Promise.all([
      supabase
        .from("areas")
        .select("id,name,active")
        .eq("hotel_id", hotelId)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("audit_templates")
        .select("id,name,area_id")
        .eq("hotel_id", hotelId)
        .order("name", { ascending: true }),
      supabase
        .from("area_template_targets")
        .select(`id,hotel_id,area_id,audit_template_id,period,target_count,active,areas(name),audit_templates(name)`)
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false }),
      supabase
        .from("area_template_target_assignments")
        .select("area_id, audit_template_id, period, target_count, active")
        .eq("hotel_id", hotelId)
        .eq("active", true),
    ]);

    if (a.error) { setError(a.error.message); setLoading(false); return; }
    if (tpls.error) { setError(tpls.error.message); setLoading(false); return; }
    if (tg.error) { setError(tg.error.message); setLoading(false); return; }
    if (ass.error) { setError(ass.error.message); setLoading(false); return; }

    setAreas((a.data ?? []) as AreaRow[]);
    setTemplates((tpls.data ?? []) as TemplateRow[]);

    const targetRows: AreaTemplateTargetRow[] = ((tg.data ?? []) as AreaTemplateTargetRowRaw[]).map((row) => ({
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

    const agg: Record<string, AssignmentAgg> = {};
    for (const row of ass.data ?? []) {
      const r = row as { area_id: string; audit_template_id: string; period: string; target_count: number | null };
      const key = `${r.area_id}__${r.audit_template_id}__${r.period}`;
      if (!agg[key]) agg[key] = { assigned_target: 0 };
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
    const row = targets.find((target) => target.id === rowId) ?? null;
    const auth = await supabase.auth.getUser();
    const actorUserId = auth.data.user?.id ?? null;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) { setError("Sesión inválida."); setSaving(false); return; }

    const response = await fetch("/api/admin/audit-targets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id: rowId }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) { setError(payload?.error ?? "No se pudo eliminar el objetivo."); setSaving(false); return; }

    if (row) {
      const logEntries: AuditLogEntryInput[] = [{
        hotel_id: hotelId,
        actor_user_id: actorUserId,
        entity_type: "area_template_target",
        entity_id: row.id,
        action: "deactivate",
        old_value: { target_count: Number(row.target_count ?? 0), active: row.active ?? true },
        new_value: null,
        metadata: {
          area_id: row.area_id,
          area_name: row.areas?.name ?? getAreaName(row.area_id),
          audit_template_id: row.audit_template_id,
          template_name: row.audit_templates?.name ?? getTemplateName(row.audit_template_id),
          period: row.period,
          source_screen: "admin_audit_targets",
        },
      }];
      try { await postAuditLogEntries(logEntries); } catch (e) { console.error(e); }
    }

    await loadAll();
    resetForm();
    setSaving(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    if (!areaId) { setError("Selecciona un área."); setSaving(false); return; }
    if (!templateId) { setError("Selecciona un template."); setSaving(false); return; }
    if (!Number.isFinite(Number(targetCount)) || Number(targetCount) < 0) {
      setError("El objetivo debe ser un número válido (>= 0).");
      setSaving(false);
      return;
    }

    const selectedTemplate = templates.find((t) => t.id === templateId);
    if (selectedTemplate?.area_id && selectedTemplate.area_id !== areaId) {
      setError("El template seleccionado no pertenece a esa área.");
      setSaving(false);
      return;
    }

    const auth = await supabase.auth.getUser();
    const createdBy = auth.data.user?.id ?? null;
    const existingTarget =
      targets.find((row) => row.id === editId) ??
      targets.find((row) => row.area_id === areaId && row.audit_template_id === templateId && row.period === period) ??
      null;

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) { setError(sessionError.message); setSaving(false); return; }
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) { setError("Sesión inválida."); setSaving(false); return; }

    const response = await fetch("/api/admin/audit-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id: editId ?? undefined, area_id: areaId, audit_template_id: templateId, period, target_count: Number(targetCount), active }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setError(result?.error ?? "No se pudo guardar el objetivo."); setSaving(false); return; }

    const nextTargetCount = Number(targetCount);
    const oldTargetCount = Number(existingTarget?.target_count ?? 0);
    const action = !existingTarget
      ? "create"
      : existingTarget.active === false && active
        ? "reactivate"
        : existingTarget.active !== false && active === false
          ? "deactivate"
          : "update";

    if (!existingTarget || oldTargetCount !== nextTargetCount || Boolean(existingTarget.active ?? true) !== active) {
      const entityId = result?.id ?? `${hotelId}:${areaId}:${period}:${templateId}`;
      const logEntries: AuditLogEntryInput[] = [{
        hotel_id: hotelId,
        actor_user_id: createdBy,
        entity_type: "area_template_target",
        entity_id: entityId,
        action,
        old_value: existingTarget ? { target_count: oldTargetCount, active: existingTarget.active ?? true } : null,
        new_value: { target_count: nextTargetCount, active },
        metadata: {
          area_id: areaId,
          area_name: getAreaName(areaId),
          audit_template_id: templateId,
          template_name: getTemplateName(templateId),
          period,
          source_screen: "admin_audit_targets",
        },
      }];
      try { await postAuditLogEntries(logEntries); } catch (e) { console.error(e); }
    }

    await loadAll();
    resetForm();
    setSaving(false);
  }

  const inputCls = "w-full px-3 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 min-h-[44px] bg-white";
  const selectCls = inputCls;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-lg font-black">Objetivos de área por auditoría</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Define cuántas veces debe realizarse cada auditoría/template dentro de un área.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => loadAll()}
            disabled={loading || saving}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            Refrescar
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            Historial
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 mt-5 mb-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">
          {editId ? "Editar objetivo" : "Crear objetivo por auditoría"}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Área</label>
            <select
              className={selectCls}
              value={areaId}
              onChange={(e) => { setAreaId(e.target.value); setTemplateId(""); }}
            >
              <option value="">{areas.length ? "Selecciona un área…" : "No se pudieron cargar áreas"}</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Auditoría / Template</label>
            <select
              className={selectCls}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={!areaId}
            >
              <option value="">{areaId ? "Selecciona un template…" : "Primero elige un área"}</option>
              {filteredTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Periodo</label>
            <select className={selectCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Objetivo total</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Activo</label>
            <select className={selectCls} value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={save}
            disabled={saving || loading}
            className="px-5 py-3 rounded-lg bg-black text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear objetivo"}
          </button>
          {editId && (
            <button
              onClick={resetForm}
              disabled={saving || loading}
              className="px-5 py-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Objetivos configurados
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : targets.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay objetivos configurados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {targets.map((t) => {
            const areaName = t.areas?.name ?? "—";
            const templateName = t.audit_templates?.name ?? "—";
            const key = `${t.area_id}__${t.audit_template_id}__${t.period}`;
            const assignedTarget = assignmentMap[key]?.assigned_target ?? 0;
            const remaining = Number(t.target_count ?? 0) - assignedTarget;
            const status = getAssignmentStatus(Number(t.target_count ?? 0), assignedTarget);

            return (
              <div
                key={t.id}
                className="rounded-xl border border-gray-100 bg-gray-50/50 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{areaName}</div>
                    <div className="text-sm font-semibold text-gray-800 leading-snug">{templateName}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(t)}
                      disabled={saving}
                      className="text-xs font-bold text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      disabled={saving}
                      className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                    {PERIOD_LABELS[t.period] ?? t.period}
                  </span>
                  <span className="text-xs text-gray-500">
                    Objetivo: <b className="text-gray-700">{t.target_count}</b>
                  </span>
                  <span className="text-xs text-gray-500">
                    Asignado: <b className="text-gray-700">{assignedTarget}</b>
                  </span>
                  <span className="text-xs text-gray-500">
                    Pendiente: <b className="text-gray-700">{remaining}</b>
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {!t.active && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-400">
                      Inactivo
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AuditLogModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        hotelId={hotelId}
        entityTypes={["area_template_target"]}
        areaId={areaId || undefined}
        period={period || undefined}
        sourceScreen="admin_audit_targets"
      />
    </div>
  );
}