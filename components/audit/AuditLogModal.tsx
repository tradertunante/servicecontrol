"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { fetchAuditLogs } from "@/lib/auditLogsClient";
import type { AuditLogEntityType, AuditLogRecord } from "@/lib/auditLogTypes";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeLog(log: AuditLogRecord) {
  const metadata = log.metadata ?? {};
  const actor = log.actor_name ?? "Alguien";

  if (log.entity_type === "team_target_assignment") {
    const templateName = String(metadata.template_name ?? "la auditoría");
    const affectedUserName = String(metadata.affected_user_name ?? "un miembro del equipo");
    return `${actor} ${log.action === "assign" ? "actualizó" : log.action === "unassign" ? "desasignó" : "actualizó"} asignación de ${templateName} para ${affectedUserName}`;
  }

  if (log.entity_type === "area_template_target") {
    const templateName = String(metadata.template_name ?? "la auditoría");
    return `${actor} ${log.action === "create" ? "creó" : log.action === "deactivate" ? "desactivó" : log.action === "reactivate" ? "reactivó" : "actualizó"} objetivo de ${templateName}`;
  }

  return `${actor} ejecutó ${log.action} en ${log.entity_type}`;
}

function valueSummary(label: string, value: Record<string, unknown> | null) {
  if (!value) return null;
  return `${label}: ${JSON.stringify(value, null, 2)}`;
}

export default function AuditLogModal({
  open,
  onClose,
  title = "Historial de cambios",
  hotelId,
  entityTypes,
  areaId,
  period,
  sourceScreen,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  hotelId: string;
  entityTypes?: AuditLogEntityType[];
  areaId?: string;
  period?: string;
  sourceScreen?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);
        const nextLogs = await fetchAuditLogs({
          hotelId,
          entityTypes,
          areaId,
          period,
          sourceScreen,
          limit: 40,
        });

        if (!alive) return;
        setLogs(nextLogs);
      } catch (error: any) {
        if (!alive) return;
        setError(error?.message ?? "No se pudo cargar el historial.");
        setLogs([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [areaId, entityTypes, hotelId, open, period, sourceScreen]);

  const overlay = useMemo<CSSProperties>(
    () => ({
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      zIndex: 50,
    }),
    []
  );

  const modal = useMemo<CSSProperties>(
    () => ({
      width: "min(920px, 100%)",
      maxHeight: "85vh",
      overflow: "auto",
      borderRadius: 18,
      background: "#fff",
      color: "#0f172a",
      border: "1px solid rgba(0,0,0,0.12)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      padding: 18,
    }),
    []
  );

  const btn = useMemo<CSSProperties>(
    () => ({
      border: "1px solid rgba(0,0,0,0.12)",
      borderRadius: 12,
      padding: "10px 12px",
      background: "#fff",
      cursor: "pointer",
      color: "#0f172a",
    }),
    []
  );

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
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
            <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
            <div style={{ opacity: 0.7, marginTop: 4, fontSize: 13 }}>
              Cambios recientes para el contexto actual.
            </div>
          </div>

          <button style={btn} onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          {loading ? (
            <div style={{ opacity: 0.8 }}>Cargando historial…</div>
          ) : error ? (
            <div style={{ color: "crimson", fontWeight: 700 }}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={{ opacity: 0.75 }}>Todavía no hay cambios registrados para este contexto.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div
                    key={log.id}
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "rgba(0,0,0,0.02)",
                      padding: 14,
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
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{summarizeLog(log)}</div>
                        <div style={{ opacity: 0.7, fontSize: 12.5, marginTop: 4 }}>
                          {formatDateTime(log.created_at)} · {log.action}
                        </div>
                      </div>

                      <button
                        style={btn}
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      >
                        {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {valueSummary("Antes", log.old_value) ? (
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              fontSize: 12,
                              padding: 12,
                              borderRadius: 12,
                              background: "rgba(15,23,42,0.05)",
                            }}
                          >
                            {valueSummary("Antes", log.old_value)}
                          </pre>
                        ) : null}
                        {valueSummary("Después", log.new_value) ? (
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              fontSize: 12,
                              padding: 12,
                              borderRadius: 12,
                              background: "rgba(15,23,42,0.05)",
                            }}
                          >
                            {valueSummary("Después", log.new_value)}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
