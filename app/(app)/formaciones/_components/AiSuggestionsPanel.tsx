"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AiTrainingSuggestion, AiSuggestionsResponse } from "../_lib/trainingTypes";

function panelStyle(): CSSProperties {
  return { border: "1px solid #e5e7eb", background: "#fff", padding: 16, borderRadius: 12 };
}

function chipStyle(color: "yellow" | "green" | "gray" | "red"): CSSProperties {
  const colors = {
    yellow: { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" },
    green: { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
    gray: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
    red: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
  };
  return {
    display: "inline-block",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 700,
    ...colors[color],
  };
}

function btnStyle(variant: "primary" | "secondary" | "danger", disabled = false): CSSProperties {
  const base: CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
  if (variant === "primary") return { ...base, background: "#111827", color: "#fff", border: "1px solid #111827" };
  if (variant === "danger") return { ...base, background: "#fff", color: "#b91c1c", border: "1px solid #fca5a5" };
  return { ...base, background: "#fff", color: "#374151" };
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

type StatusFilter = "pending" | "approved" | "all";

const STATUS_LABELS: Record<AiTrainingSuggestion["review_status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  realized: "Realizada",
};
const STATUS_CHIP: Record<AiTrainingSuggestion["review_status"], "yellow" | "green" | "gray" | "red"> = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
  realized: "gray",
};

function formatDate(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return v;
  }
}

type Props = { onSuggestionApproved?: () => void };

export default function AiSuggestionsPanel({ onSuggestionApproved }: Props) {
  const [suggestions, setSuggestions] = useState<AiTrainingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const url =
        filter === "all"
          ? "/api/trainings/suggestions"
          : `/api/trainings/suggestions?status=${filter}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json().catch(() => null)) as AiSuggestionsResponse | { error?: string } | null;
      if (!res.ok) throw new Error(payload && "error" in payload ? (payload.error ?? "Error al cargar sugerencias.") : "Error al cargar sugerencias.");
      setSuggestions(payload && "suggestions" in payload ? payload.suggestions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar sugerencias.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function doAction(id: string, action: "approve" | "reject" | "realize") {
    try {
      setBusyId(`${action}:${id}`);
      setError(null);
      const token = await getToken();
      const res = await fetch(`/api/trainings/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Error al procesar acción.");
      if (action === "approve") onSuggestionApproved?.();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = suggestions.filter((s) => s.review_status === "pending").length;

  return (
    <div style={panelStyle()}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Sugerencias de formacion</div>
        {pendingCount > 0 && filter !== "all" && (
          <span style={chipStyle("yellow")}>{pendingCount} pendiente{pendingCount > 1 ? "s" : ""}</span>
        )}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>Generadas por IA</div>
      </div>
      <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.5 }}>
        El sistema analiza los patrones de fallos de auditoria y sugiere temas de formacion al equipo. El manager revisa y aprueba; Calidad queda notificado.
      </div>

      {/* Filter tabs */}
      <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["pending", "approved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              border: "1px solid",
              borderColor: filter === f ? "#111827" : "#d1d5db",
              background: filter === f ? "#111827" : "#fff",
              color: filter === f ? "#fff" : "#374151",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {f === "pending" ? "Pendientes" : f === "approved" ? "Aprobadas" : "Todas"}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {loading ? (
          <div style={{ color: "#6b7280" }}>Cargando sugerencias...</div>
        ) : error ? (
          <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div>
        ) : suggestions.length === 0 ? (
          <div style={{ color: "#6b7280" }}>
            {filter === "pending"
              ? "No hay sugerencias pendientes de revision."
              : "No hay sugerencias en este estado."}
          </div>
        ) : (
          suggestions.map((s) => {
            const isExpanded = expandedId === s.id;
            const isBusy = busyId !== null && busyId.endsWith(`:${s.id}`);
            return (
              <div
                key={s.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 14,
                  background: s.review_status === "pending" ? "#fffbeb" : "#f9fafb",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={chipStyle(STATUS_CHIP[s.review_status])}>
                        {STATUS_LABELS[s.review_status]}
                      </span>
                      <span style={{ fontSize: 13, color: "#6b7280" }}>
                        {s.area_name ?? "Área"} · {formatDate(s.created_at)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                      {s.question_text}
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563", marginTop: 2 }}>
                      Fallo reciente: <b>{Math.round(s.trigger_ratio * 100)}%</b> ({s.trigger_count} fallos en {s.trigger_period_days} días)
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      style={btnStyle("secondary")}
                    >
                      {isExpanded ? "Ocultar" : "Ver contenido"}
                    </button>
                    {s.review_status === "pending" && (
                      <>
                        <button
                          onClick={() => void doAction(s.id, "approve")}
                          disabled={isBusy}
                          style={btnStyle("primary", isBusy)}
                        >
                          {busyId === `approve:${s.id}` ? "Aprobando..." : "Aprobar"}
                        </button>
                        <button
                          onClick={() => void doAction(s.id, "reject")}
                          disabled={isBusy}
                          style={btnStyle("danger", isBusy)}
                        >
                          {busyId === `reject:${s.id}` ? "Rechazando..." : "Rechazar"}
                        </button>
                      </>
                    )}
                    {s.review_status === "approved" && (
                      <button
                        onClick={() => void doAction(s.id, "realize")}
                        disabled={isBusy}
                        style={btnStyle("secondary", isBusy)}
                      >
                        {busyId === `realize:${s.id}` ? "Guardando..." : "Marcar como realizada"}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: 14,
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 14,
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    {s.ai_content.objective && (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 4 }}>
                          Objetivo
                        </div>
                        <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.6 }}>
                          {s.ai_content.objective}
                        </div>
                      </div>
                    )}
                    {s.ai_content.procedure?.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 6 }}>
                          Protocolo a seguir
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                          {s.ai_content.procedure.map((step, i) => (
                            <li key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {s.ai_content.checklist?.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 6 }}>
                          Checklist de verificacion
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                          {s.ai_content.checklist.map((item, i) => (
                            <li key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.ai_content.questions?.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 6 }}>
                          Preguntas de comprension
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                          {s.ai_content.questions.map((q, i) => (
                            <li key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>{q}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {s.review_status !== "pending" && (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {s.approved_at && `Aprobada: ${formatDate(s.approved_at)}`}
                        {s.realized_at && ` · Realizada: ${formatDate(s.realized_at)}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}