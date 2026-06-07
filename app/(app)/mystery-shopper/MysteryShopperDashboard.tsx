"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/types";

type TemplateProgress = {
  template_id: string;
  template_name: string;
  submitted_count: number;
  draft_count: number;
  last_run: { id: string; status: string; score: number | null; executed_at: string | null } | null;
  done: boolean;
};

type AreaProgress = {
  area_id: string;
  area_name: string;
  total_templates: number;
  done_templates: number;
  templates: TemplateProgress[];
};

type Progress = {
  shopper_id: string;
  total_templates: number;
  done_templates: number;
  access_expires_at: string | null;
  areas: AreaProgress[];
};

function v(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

function scoreColor(score: number | null) {
  if (score === null) return "#94a3b8";
  if (score >= 85) return "#22c55e";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

export default function MysteryShopperDashboard({
  hotelId,
  profile,
  shopperId,
}: {
  hotelId: string;
  profile: Profile;
  shopperId: string;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [startingTemplate, setStartingTemplate] = useState<string | null>(null);
  const [reopeningRun, setReopeningRun] = useState<string | null>(null);

  const periodActive =
    !progress?.access_expires_at ||
    new Date(progress.access_expires_at) > new Date();

  async function handleReopen(runId: string) {
    setReopeningRun(runId);
    try {
      const res = await fetch("/api/audits/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runId }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = `/audits/${runId}`;
      } else {
        alert(data.error ?? "No se pudo reabrir la auditoría.");
        setReopeningRun(null);
      }
    } catch {
      alert("Error de conexión.");
      setReopeningRun(null);
    }
  }

  const isShopper = profile.role === "mystery_shopper";

  async function startAudit(areaId: string, templateId: string) {
    setStartingTemplate(templateId);
    try {
      const res = await fetch("/api/audits/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_id: areaId, audit_template_id: templateId }),
      });
      const data = await res.json();
      if (data.ok && data.run_id) {
        window.location.href = `/audits/${data.run_id}`;
      } else {
        alert(data.error ?? "No se pudo iniciar la auditoría.");
      }
    } catch {
      alert("Error de conexión.");
    } finally {
      setStartingTemplate(null);
    }
  }

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const qs = isShopper ? "" : `?shopper_id=${shopperId}`;
      const res = await fetch(`/api/mystery-shopper/progress${qs}`);
      const data = await res.json();
      if (data.ok) setProgress(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isShopper, shopperId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  async function handleSendReport() {
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const res = await fetch("/api/mystery-shopper/report/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: isShopper ? "{}" : JSON.stringify({ shopper_id: shopperId }),
      });
      const data = await res.json();
      if (data.ok) {
        setSendResult(
          data.sent_to?.length > 0
            ? `Reporte enviado a: ${data.sent_to.join(", ")}`
            : "Reporte generado (no hay suscriptores configurados)."
        );
      } else {
        setSendError(data.error ?? "Error al enviar el reporte.");
      }
    } catch {
      setSendError("Error de conexión.");
    } finally {
      setSending(false);
    }
  }

  const cardBase = {
    border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.10)")}`,
    borderRadius: 14,
    padding: 20,
    background: v("--sc-card-bg", "rgba(255,255,255,0.04)"),
  };

  const btnPrimary = {
    background: v("--sc-accent", "#0f172a"),
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 22px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 38,
  };

  if (loading) {
    return (
      <div className="w-full p-[18px]">
        <div style={{ fontSize: 13, opacity: 0.55 }}>Cargando panel...</div>
      </div>
    );
  }

  const total = progress?.total_templates ?? 0;
  const done = progress?.done_templates ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="w-full p-[18px]" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {isShopper ? "Panel Mystery Shopper" : "Panel Mystery Shopper (vista admin)"}
            </div>
            <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
              {isShopper
                ? "Completa las auditorías de todas las áreas y envía el reporte al terminar."
                : `Progreso del shopper · ID: ${shopperId}`}
            </div>
          </div>
          <button
            style={btnPrimary}
            onClick={handleSendReport}
            disabled={sending}
          >
            {sending ? "Enviando..." : "Enviar reporte"}
          </button>
        </div>

        {sendResult && (
          <div style={{ marginTop: 12, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#22c55e" }}>
            {sendResult}
          </div>
        )}
        {sendError && (
          <div style={{ marginTop: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
            {sendError}
          </div>
        )}
      </div>

      {/* Progress summary */}
      <div style={{ ...cardBase, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Progreso general</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: done === total && total > 0 ? "#22c55e" : "inherit" }}>{done}</span>
            <span style={{ opacity: 0.5 }}> / {total} auditorías completadas</span>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: pct === 100 ? "#22c55e" : pct > 50 ? "#3b82f6" : "#f59e0b",
              borderRadius: 4,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>{pct}% completado</div>
      </div>

      {/* Areas grid */}
      <div style={{ display: "grid", gap: 12 }}>
        {(progress?.areas ?? []).map((area) => {
          const isExpanded = expandedArea === area.area_id;
          const areaPct = area.total_templates > 0
            ? Math.round((area.done_templates / area.total_templates) * 100)
            : 0;

          return (
            <div key={area.area_id} style={cardBase}>
              {/* Area header */}
              <button
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, color: "inherit" }}
                onClick={() => setExpandedArea(isExpanded ? null : area.area_id)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{area.area_name}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        background: areaPct === 100 ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.06)",
                        color: areaPct === 100 ? "#22c55e" : "inherit",
                      }}>
                        {area.done_templates}/{area.total_templates}
                      </span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden", marginTop: 8, maxWidth: 200 }}>
                      <div style={{ height: "100%", width: `${areaPct}%`, background: areaPct === 100 ? "#22c55e" : "#3b82f6", borderRadius: 2 }} />
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 200ms", opacity: 0.5, flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Templates list */}
              {isExpanded && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${v("--sc-border", "rgba(255,255,255,0.07)")}`, paddingTop: 14 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    {area.templates.map((t) => (
                      <div key={t.template_id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                        padding: "10px 14px", borderRadius: 10,
                        background: t.done ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${t.done ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)"}`,
                        flexWrap: "wrap",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                          {/* Status icon */}
                          {t.done ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)" }} />
                          )}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.template_name}</span>
                          {t.draft_count > 0 && !t.done && (
                            <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 600 }}>
                              Borrador
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          {t.last_run?.score !== null && t.last_run?.score !== undefined && (
                            <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(t.last_run.score) }}>
                              {t.last_run.score}%
                            </span>
                          )}
                          {t.last_run ? (
                            <>
                              <a
                                href={`/audits/${t.last_run.id}${t.done ? "/report" : ""}`}
                                style={{ fontSize: 12, fontWeight: 600, color: "inherit", opacity: 0.7, textDecoration: "underline" }}
                              >
                                {t.done ? "Ver reporte" : "Continuar"}
                              </a>
                              {t.done && periodActive && (
                                <button
                                  onClick={() => handleReopen(t.last_run!.id)}
                                  disabled={reopeningRun === t.last_run.id}
                                  style={{ fontSize: 12, fontWeight: 600, color: "inherit", opacity: reopeningRun === t.last_run.id ? 0.4 : 0.7, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                >
                                  {reopeningRun === t.last_run.id ? "Reabriendo..." : "Editar"}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => startAudit(area.area_id, t.template_id)}
                              disabled={startingTemplate === t.template_id}
                              style={{ fontSize: 12, fontWeight: 600, color: "inherit", opacity: startingTemplate === t.template_id ? 0.4 : 0.7, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              {startingTemplate === t.template_id ? "Iniciando..." : "Iniciar"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary table (flat view) */}
      {(progress?.areas ?? []).length > 0 && (
        <div style={{ ...cardBase, marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Resumen de auditorías</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Área", "Auditoría", "Estado", "Score", "Fecha", ""].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5, borderBottom: `1px solid ${v("--sc-border", "rgba(255,255,255,0.08)")}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(progress?.areas ?? []).flatMap((area) =>
                  area.templates.map((t) => (
                    <tr key={t.template_id} style={{ borderBottom: `1px solid ${v("--sc-border", "rgba(255,255,255,0.05)")}` }}>
                      <td style={{ padding: "10px 12px", opacity: 0.8 }}>{area.area_name}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{t.template_name}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {t.done ? (
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(34,197,94,0.10)", color: "#22c55e", fontWeight: 700 }}>Completada</span>
                        ) : t.draft_count > 0 ? (
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 700 }}>En progreso</span>
                        ) : (
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.06)", opacity: 0.6, fontWeight: 600 }}>Pendiente</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: scoreColor(t.last_run?.score ?? null) }}>
                        {t.last_run?.score !== null && t.last_run?.score !== undefined ? `${t.last_run.score}%` : "-"}
                      </td>
                      <td style={{ padding: "10px 12px", opacity: 0.6, whiteSpace: "nowrap" }}>
                        {t.last_run?.executed_at
                          ? new Date(t.last_run.executed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "-"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {t.last_run ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <a href={`/audits/${t.last_run.id}${t.done ? "/report" : ""}`} style={{ fontSize: 12, fontWeight: 600, color: "inherit", textDecoration: "underline", opacity: 0.7 }}>
                              {t.done ? "Ver reporte" : "Continuar"}
                            </a>
                            {t.done && periodActive && (
                              <button
                                onClick={() => handleReopen(t.last_run!.id)}
                                disabled={reopeningRun === t.last_run.id}
                                style={{ fontSize: 12, fontWeight: 600, color: "inherit", textDecoration: "underline", opacity: reopeningRun === t.last_run.id ? 0.4 : 0.7, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                {reopeningRun === t.last_run.id ? "Reabriendo..." : "Editar"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => startAudit(area.area_id, t.template_id)}
                            disabled={startingTemplate === t.template_id}
                            style={{ fontSize: 12, fontWeight: 600, color: "inherit", textDecoration: "underline", opacity: startingTemplate === t.template_id ? 0.4 : 0.7, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            {startingTemplate === t.template_id ? "Iniciando..." : "Iniciar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}