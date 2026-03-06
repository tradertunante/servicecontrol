"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

type TemplateRow = { id: string; name: string };
type AuditorRow = { id: string; full_name: string | null; role: string | null };

type TargetRow = {
  id: string;
  hotel_id: string;
  target_scope: string;
  user_id: string | null;
  audit_template_id: string;
  period: string;
  target_count: number;
  active: boolean | null;

  audit_templates?: { name: string | null } | null;
  profiles?: { full_name: string | null } | null;
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

async function safeRefreshTargetTasks() {
  const iso = new Date().toISOString();

  // Dependiendo de cómo nombraste el parámetro en SQL, probamos varias opciones
  let r = await supabase.rpc("refresh_target_tasks", { now: iso });
  if (!r.error) return;

  r = await supabase.rpc("refresh_target_tasks", { p_now: iso });
  if (!r.error) return;

  r = await supabase.rpc("refresh_target_tasks", { _now: iso });
  if (!r.error) return;

  // Si la función no tiene params
  await supabase.rpc("refresh_target_tasks", {});
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

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [auditors, setAuditors] = useState<AuditorRow[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);

  // Form
  const [editId, setEditId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [period, setPeriod] = useState<string>("daily");
  const [targetCount, setTargetCount] = useState<number>(3);
  const [active, setActive] = useState<boolean>(true);

  function resetForm() {
    setEditId(null);
    setUserId("");
    setTemplateId("");
    setPeriod("daily");
    setTargetCount(3);
    setActive(true);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    // Templates
    const t = await supabase
      .from("audit_templates")
      .select("id,name")
      .eq("hotel_id", hotelId)
      .order("name", { ascending: true });

    if (t.error) {
      setError(t.error.message);
      setLoading(false);
      return;
    }
    setTemplates((t.data ?? []) as TemplateRow[]);

    // Auditors (si tu profiles tiene hotel_id; si no, ajustamos luego)
    const a = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("hotel_id", hotelId)
      .eq("role", "auditor")
      .order("full_name", { ascending: true });

    if (a.error) {
      // No rompemos; mostramos mensaje útil
      setAuditors([]);
    } else {
      setAuditors((a.data ?? []) as AuditorRow[]);
    }

    // Targets (auditor_template)
    const tg = await supabase
      .from("audit_targets")
      .select(
        `
        id, hotel_id, target_scope, user_id, audit_template_id, period, target_count, active,
        audit_templates(name),
        profiles(full_name)
      `
      )
      .eq("hotel_id", hotelId)
      .eq("target_scope", "auditor_template")
      .order("created_at", { ascending: false });

    if (tg.error) {
      setError(tg.error.message);
      setLoading(false);
      return;
    }

    setTargets((tg.data ?? []) as TargetRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  function startEdit(row: TargetRow) {
    setEditId(row.id);
    setUserId(row.user_id ?? "");
    setTemplateId(row.audit_template_id);
    setPeriod(row.period ?? "daily");
    setTargetCount(Number(row.target_count ?? 0) || 0);
    setActive(Boolean(row.active ?? true));
  }

  async function remove(rowId: string) {
    if (!confirm("¿Eliminar este objetivo?")) return;
    setSaving(true);
    setError(null);

    const d = await supabase.from("audit_targets").delete().eq("id", rowId);
    if (d.error) {
      setError(d.error.message);
      setSaving(false);
      return;
    }

    // Regenerar tareas (para que desaparezcan si aplica)
    await safeRefreshTargetTasks();
    await loadAll();
    setSaving(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    if (!userId) {
      setError("Selecciona un auditor.");
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

    const auth = await supabase.auth.getUser();
    const createdBy = auth.data.user?.id ?? null; // auth.uid()

    // Si tu tabla audit_targets NO requiere created_by, esto no afecta.
    // Si lo requiere, lo dejamos incluido.
    const payload: any = {
      id: editId ?? undefined,
      hotel_id: hotelId,
      target_scope: "auditor_template",
      user_id: userId,
      audit_template_id: templateId,
      period,
      target_count: Number(targetCount),
      active,
      created_by: createdBy,
    };

    // Intento 1: upsert con ON CONFLICT por columnas (si existe índice unique compatible)
    let up = await supabase
      .from("audit_targets")
      .upsert(payload, {
        onConflict: "hotel_id,target_scope,user_id,audit_template_id,period",
        ignoreDuplicates: false,
      })
      .select("id")
      .maybeSingle();

    // Si falla por falta de constraint (42P10), hacemos estrategia manual
    if (up.error && String(up.error.message || "").includes("there is no unique or exclusion constraint")) {
      // Buscar si ya existe
      const ex = await supabase
        .from("audit_targets")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("target_scope", "auditor_template")
        .eq("user_id", userId)
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
        const u = await supabase.from("audit_targets").update(payload).eq("id", ex.data.id);
        if (u.error) {
          setError(u.error.message);
          setSaving(false);
          return;
        }
      } else {
        const i = await supabase.from("audit_targets").insert(payload);
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

    // ✅ Recalcular/generar tasks de objetivos
    await safeRefreshTargetTasks();

    await loadAll();
    resetForm();
    setSaving(false);
  }

  const hasAuditors = auditors.length > 0;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Objetivos de auditoría</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Configura cuántas auditorías debe realizar cada auditor por template (por ejemplo “3 diarias”).
          </div>
        </div>

        <button style={btn} onClick={() => loadAll()} disabled={loading || saving}>
          Refrescar
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,0,0,0.25)", background: "rgba(255,0,0,0.06)" }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {/* FORM */}
      <div style={{ marginTop: 14, padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.10)" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{editId ? "Editar objetivo" : "Crear objetivo"}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Auditor</div>
            <select style={select} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">{hasAuditors ? "Selecciona un auditor…" : "No se pudieron cargar auditores"}</option>
              {auditors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ?? u.id.slice(0, 8)}
                </option>
              ))}
            </select>
            {!hasAuditors ? (
              <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                Si tu tabla <b>profiles</b> no tiene <b>hotel_id</b>, dime cómo asignas usuarios a hoteles y lo ajusto.
              </div>
            ) : null}
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Template</div>
            <select style={select} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Selecciona un template…</option>
              {templates.map((t) => (
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
              <option value="weekly" disabled>
                Semanal (próximamente)
              </option>
              <option value="monthly" disabled>
                Mensual (próximamente)
              </option>
            </select>
          </div>

          <div>
            <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Objetivo</div>
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

      {/* LIST */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Objetivos configurados</div>

        {loading ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Cargando…</div>
        ) : targets.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Aún no hay objetivos creados.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {targets.map((t) => {
              const auditorName = t.profiles?.full_name ?? (t.user_id ? t.user_id.slice(0, 8) : "—");
              const templateName = t.audit_templates?.name ?? t.audit_template_id.slice(0, 8);

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
                  <div style={{ minWidth: 280 }}>
                    <div style={{ fontWeight: 750 }}>
                      {auditorName} · <span style={{ opacity: 0.9 }}>{templateName}</span>
                    </div>
                    <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
                      Periodo: <b>{t.period}</b> · Objetivo: <b>{t.target_count}</b> · Activo: <b>{t.active ? "sí" : "no"}</b>
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