// FILE: app/(app)/areas/[areaId]/_components/HistoryPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import type { AuditRunRow, AuditTemplate, PeriodKey, Role } from "../_lib/areaTypes";
import {
  canDeleteAudits,
  fmtDate,
  getPeriodRange,
  monthLabel,
  monthStartEndISO,
  safePeriod,
  scoreColor,
} from "../_lib/areaUtils";

const card: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.75)",
  padding: 18,
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.20)",
  background: "#fff",
  fontWeight: 900,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#000",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.25)",
  background: "#fff",
  color: "#b00020",
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function chipStyle(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "#fff",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    opacity: 0.9,
    whiteSpace: "nowrap",
  };
}

export default function HistoryPanel({
  areaId,
  profileRole,
  templates,
  onViewRun,
  onDeleteSuccess,
}: {
  areaId: string;
  profileRole: Role | null;
  templates: AuditTemplate[];
  onViewRun: (runId: string) => void;
  onDeleteSuccess: (deletedRunId: string) => void;
}) {
  const searchParams = useSearchParams();
  const now = new Date();

  // ✅ filtros "manuales" (mes/año) para el modo clásico
  const [histTemplateId, setHistTemplateId] = useState<string>("");
  const [histYear, setHistYear] = useState<number>(now.getFullYear());
  const [histMonth, setHistMonth] = useState<number>(now.getMonth());

  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  const [histRuns, setHistRuns] = useState<AuditRunRow[]>([]);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  const showDelete = canDeleteAudits(profileRole);

  // ✅ params desde dashboard
  const urlTemplate = searchParams.get("template") ?? "ALL";
  const urlPeriod = safePeriod(searchParams.get("period"));
  const urlFailQ = (searchParams.get("fail_q") ?? "").trim();
  const urlFailCls = (searchParams.get("fail_cls") ?? "").trim();

  const isFailMode = Boolean(urlFailQ || urlFailCls);

  // ✅ si no hay histTemplateId, pon el primero
  useEffect(() => {
    if (!histTemplateId && templates.length > 0) {
      setHistTemplateId(templates[0].id);
    }
  }, [templates, histTemplateId]);

  // -------------------------
  // Query helpers
  // -------------------------
  async function fetchRunsByPeriodAndViewAndFail() {
    if (!areaId) return;

    setHistLoading(true);
    setHistError(null);

    try {
      const { startMs, endMs } = getPeriodRange(new Date(), urlPeriod as PeriodKey);
      const startISO = new Date(startMs).toISOString();
      const endISO = new Date(endMs).toISOString();

      // 1) Runs base (submitted + area + rango + (vista opcional))
      let q = supabase
        .from("audit_runs")
        .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
        .eq("area_id", areaId)
        .eq("status", "submitted")
        .gte("executed_at", startISO)
        .lte("executed_at", endISO)
        .order("executed_at", { ascending: false });

      if (urlTemplate !== "ALL") {
        q = q.eq("audit_template_id", urlTemplate);
      }

      const { data: runsData, error: runsErr } = await q;
      if (runsErr) throw runsErr;

      const runs = (runsData ?? []) as AuditRunRow[];
      if (runs.length === 0) {
        setHistRuns([]);
        return;
      }

      // 2) Si no hay filtro de fail (por seguridad), lista directa
      if (!urlFailQ && !urlFailCls) {
        setHistRuns(runs);
        return;
      }

      // 3) Filtrar por FAIL: buscamos audit_answers FAIL de esos runs
      const runIds = runs.map((r) => r.id);

      let aQ = supabase
        .from("audit_answers")
        .select("audit_run_id,question_id,result")
        .in("audit_run_id", runIds)
        .eq("result", "FAIL");

      if (urlFailQ) {
        aQ = aQ.eq("question_id", urlFailQ);
      }

      const { data: ansData, error: ansErr } = await aQ;
      if (ansErr) throw ansErr;

      const answers = (ansData ?? []) as any[];

      // si es por clasificación, necesitamos mapear question_id -> classification
      let allowedRunIds = new Set<string>();

      if (urlFailCls) {
        const qIds = Array.from(new Set(answers.map((a) => a.question_id).filter(Boolean)));

        if (qIds.length === 0) {
          setHistRuns([]);
          return;
        }

        const { data: qData, error: qErr } = await supabase
          .from("audit_questions")
          .select("id,classification")
          .in("id", qIds);

        if (qErr) throw qErr;

        const clsByQ: Record<string, string> = {};
        for (const row of (qData ?? []) as any[]) clsByQ[row.id] = String(row.classification ?? "");

        for (const a of answers) {
          const cls = (clsByQ[a.question_id] ?? "").trim() || "Sin clasificación";
          if (cls === urlFailCls) allowedRunIds.add(a.audit_run_id);
        }
      } else {
        // filtro solo por question_id
        for (const a of answers) allowedRunIds.add(a.audit_run_id);
      }

      const filtered = runs.filter((r) => allowedRunIds.has(r.id));
      setHistRuns(filtered);
    } catch (e: any) {
      setHistError(e?.message ?? "No se pudo cargar el historial filtrado.");
      setHistRuns([]);
    } finally {
      setHistLoading(false);
    }
  }

  async function handleSearchHistoryMonthMode() {
    if (!areaId || !histTemplateId) return;

    setHistLoading(true);
    setHistError(null);

    try {
      const { start, end } = monthStartEndISO(histYear, histMonth);

      const { data, error: rErr } = await supabase
        .from("audit_runs")
        .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
        .eq("area_id", areaId)
        .eq("status", "submitted")
        .eq("audit_template_id", histTemplateId)
        .gte("executed_at", start)
        .lt("executed_at", end)
        .order("executed_at", { ascending: false });

      if (rErr) throw rErr;

      setHistRuns((data ?? []) as AuditRunRow[]);
    } catch (e: any) {
      setHistError(e?.message ?? "No se pudo buscar el historial.");
      setHistRuns([]);
    } finally {
      setHistLoading(false);
    }
  }

  async function handleDeleteAudit(runId: string) {
    if (!showDelete) return;

    const ok = window.confirm(
      "¿Seguro que quieres borrar esta auditoría?\n\nEsto eliminará el registro y sus respuestas. No se puede deshacer."
    );
    if (!ok) return;

    setDeletingRunId(runId);
    setHistError(null);

    try {
      const { error: aErr } = await supabase.from("audit_answers").delete().eq("audit_run_id", runId);
      if (aErr) throw aErr;

      const { error: rErr } = await supabase.from("audit_runs").delete().eq("id", runId);
      if (rErr) throw rErr;

      setHistRuns((prev) => prev.filter((x) => x.id !== runId));
      onDeleteSuccess(runId);
    } catch (e: any) {
      setHistError(e?.message ?? "No se pudo borrar la auditoría.");
    } finally {
      setDeletingRunId(null);
    }
  }

  // ✅ auto-carga cuando vienes del dashboard con fail filters
  useEffect(() => {
    if (!areaId) return;
    if (!isFailMode) return;
    fetchRunsByPeriodAndViewAndFail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, urlTemplate, urlPeriod, urlFailQ, urlFailCls]);

  const activeChips = useMemo(() => {
    const out: { label: string }[] = [];
    if (!isFailMode) return out;

    out.push({ label: `Periodo: ${String(urlPeriod)}` });
    out.push({ label: urlTemplate === "ALL" ? "Vista: General" : "Vista: Por tipo" });

    if (urlFailQ) out.push({ label: `Estándar: ${urlFailQ}` });
    if (urlFailCls) out.push({ label: `Clasificación: ${urlFailCls}` });

    return out;
  }, [isFailMode, urlPeriod, urlTemplate, urlFailQ, urlFailCls]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 20, fontWeight: 950 }}>Historial</div>

          {isFailMode ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {activeChips.map((c, idx) => (
                <span key={`${c.label}-${idx}`} style={chipStyle()}>
                  {c.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* ✅ MODO FILTRADO (desde dashboard) */}
        {isFailMode ? (
          <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, fontWeight: 900 }}>
            Mostrando auditorías donde hubo <strong>FAIL</strong> según el filtro seleccionado.
          </div>
        ) : null}

        {/* ✅ MODO CLÁSICO (mes/año) */}
        {!isFailMode ? (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>Tipo de auditoría</div>
              <select value={histTemplateId} onChange={(e) => setHistTemplateId(e.target.value)} style={inputStyle}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                {templates.length === 0 ? <option value="">No hay auditorías</option> : null}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>Año</div>
              <select value={histYear} onChange={(e) => setHistYear(Number(e.target.value))} style={inputStyle}>
                {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>Mes</div>
              <select value={histMonth} onChange={(e) => setHistMonth(Number(e.target.value))} style={inputStyle}>
                {Array.from({ length: 12 }, (_, m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={handleSearchHistoryMonthMode} style={primaryBtn} disabled={!histTemplateId || histLoading}>
                {histLoading ? "Buscando…" : "Buscar"}
              </button>
              <button
                onClick={() => {
                  setHistRuns([]);
                  setHistError(null);
                }}
                style={ghostBtn}
                disabled={histLoading}
              >
                Limpiar
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={fetchRunsByPeriodAndViewAndFail} style={primaryBtn} disabled={histLoading}>
              {histLoading ? "Cargando…" : "Actualizar"}
            </button>
            <button
              onClick={() => {
                // Solo limpiamos resultados en modo filtrado
                setHistRuns([]);
                setHistError(null);
              }}
              style={ghostBtn}
              disabled={histLoading}
            >
              Limpiar
            </button>
          </div>
        )}

        {histError ? <div style={{ marginTop: 12, color: "crimson", fontWeight: 900 }}>{histError}</div> : null}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Resultados</div>
          {histLoading ? (
            <div style={{ fontWeight: 900, opacity: 0.75 }}>Cargando…</div>
          ) : (
            <div style={{ fontWeight: 900, opacity: 0.75 }}>{histRuns.length} auditorías</div>
          )}
        </div>

        {histRuns.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            {isFailMode ? (
              <>
                No hay auditorías con <strong>FAIL</strong> para ese filtro.
              </>
            ) : (
              <>
                No hay auditorías para ese periodo. Selecciona filtros y pulsa <strong>Buscar</strong>.
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {histRuns.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(0,0,0,0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontWeight: 950 }}>{fmtDate(r.executed_at)}</div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                    Score:{" "}
                    <span style={{ fontWeight: 950, color: scoreColor(r.score) }}>
                      {r.score === null ? "—" : `${Number(r.score).toFixed(2)}%`}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => onViewRun(r.id)} style={primaryBtn}>
                    Ver auditoría
                  </button>

                  {showDelete ? (
                    <button
                      onClick={() => handleDeleteAudit(r.id)}
                      style={dangerBtn}
                      disabled={deletingRunId === r.id}
                      title="Borrar auditoría"
                    >
                      {deletingRunId === r.id ? "Borrando…" : "Borrar"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}