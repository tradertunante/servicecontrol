// FILE: app/(app)/team/page.tsx
"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

import { useTeamData, type TeamPeriodKey } from "./_hooks/useTeamData";
import TeamTargetAssignmentsCard from "./_components/TeamTargetAssignmentsCard";

function buildCardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.20)",
  };
}

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    cursor: "pointer",
  };
}

function buildInputStyle(): CSSProperties {
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

function getPeriodLabel(period: TeamPeriodKey) {
  if (period === "daily") return "hoy";
  if (period === "weekly") return "esta semana";
  return "este mes";
}

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(0)}%`;
}

const HOTEL_KEY = "sc_hotel_id";

export default function TeamPage() {
  const router = useRouter();
  requireRoleOrRedirect(["superadmin", "admin", "manager", "quality"], router);

  const card = useMemo(() => buildCardStyle(), []);
  const btn = useMemo(() => buildBtnStyle(), []);
  const input = useMemo(() => buildInputStyle(), []);

  const [selectedPeriod, setSelectedPeriod] = useState<TeamPeriodKey>("monthly");
  const [showAssignmentsConfig, setShowAssignmentsConfig] = useState(false);

  const { loading, error, profile, leaderboard, teamTargets, teamRecentRuns, summary } =
    useTeamData(selectedPeriod);

  const panelBodyStyle: CSSProperties = {
    marginTop: 10,
    display: "grid",
    gap: 10,
    maxHeight: 620,
    overflowY: "auto",
    paddingRight: 4,
    alignContent: "start",
  };

  const progressTrackStyle: CSSProperties = {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  };

  const groupedTargetsByAuditor = useMemo(() => {
    const map: Record<
      string,
      {
        auditor: string;
        auditorUserId: string;
        rows: typeof teamTargets;
        targetSum: number;
        completedSum: number;
        remainingSum: number;
        progressPct: number;
      }
    > = {};

    for (const row of teamTargets) {
      const key = row.auditor_user_id;
      if (!map[key]) {
        map[key] = {
          auditor: row.auditor ?? "—",
          auditorUserId: row.auditor_user_id,
          rows: [],
          targetSum: 0,
          completedSum: 0,
          remainingSum: 0,
          progressPct: 0,
        };
      }

      map[key].rows.push(row);
      map[key].targetSum += Number(row.target ?? 0);
      map[key].completedSum += Number(row.completed ?? 0);
      map[key].remainingSum += Number(row.remaining ?? 0);
    }

    const result = Object.values(map).map((group) => {
      group.rows.sort((a, b) => {
        const remDiff = Number(b.remaining ?? 0) - Number(a.remaining ?? 0);
        if (remDiff !== 0) return remDiff;
        return String(a.template ?? "").localeCompare(String(b.template ?? ""));
      });

      group.progressPct =
        group.targetSum > 0 ? (group.completedSum / group.targetSum) * 100 : 0;

      return group;
    });

    result.sort((a, b) => {
      const remDiff = b.remainingSum - a.remainingSum;
      if (remDiff !== 0) return remDiff;

      const pctDiff = a.progressPct - b.progressPct;
      if (pctDiff !== 0) return pctDiff;

      return a.auditor.localeCompare(b.auditor);
    });

    return result;
  }, [teamTargets]);

  const insights = useMemo(() => {
    const list: {
      type: "warning" | "info";
      title: string;
      text: string;
    }[] = [];

    if (summary.totalTargets > 0 && summary.totalAuditsDone === 0) {
      list.push({
        type: "warning",
        title: "Atención",
        text: "El equipo aún no ha iniciado el objetivo del periodo.",
      });
    } else {
      if (summary.totalTargets > 0) {
        const ratio = summary.totalRemaining / summary.totalTargets;

        if (ratio > 0.7) {
          list.push({
            type: "warning",
            title: "Retraso en objetivos",
            text: "Queda más del 70% del objetivo del periodo por completar.",
          });
        }
      }
    }

    if (groupedTargetsByAuditor.length > 0) {
      const top = groupedTargetsByAuditor[0];

      if (top.remainingSum > 0) {
        list.push({
          type: "info",
          title: "Reparto de carga",
          text: `${top.auditor} concentra la mayor carga pendiente (${top.remainingSum} auditorías).`,
        });
      }
    }

    return list.slice(0, 3);
  }, [summary, groupedTargetsByAuditor]);

  const hotelId = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) ?? "" : "";

  return (
    <div style={{ padding: 18, width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Equipo</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Hola, <b>{profile?.full_name ?? "—"}</b> · Rol: <b>{profile?.role ?? "—"}</b>
          </div>
          <div style={{ opacity: 0.65, marginTop: 6, fontSize: 12 }}>
            Panel operativo del equipo y seguimiento de objetivos.
          </div>
        </div>

        <div style={{ minWidth: 220 }}>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo global</div>
          <select
            style={input}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as TeamPeriodKey)}
          >
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 14, ...card, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Auditorías equipo · {getPeriodLabel(selectedPeriod)}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{summary.totalAuditsDone}</div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Objetivo total · {getPeriodLabel(selectedPeriod)}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>
            {summary.totalCompletedTargets} / {summary.totalTargets}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Restantes · {getPeriodLabel(selectedPeriod)}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{summary.totalRemaining}</div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Progreso global</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{formatPct(summary.globalPct)}</div>
        </div>
      </div>

      {insights.length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            Insights del sistema
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 10,
            }}
          >
            {insights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  padding: 12,
                  background:
                    insight.type === "warning"
                      ? "rgba(255,180,0,0.08)"
                      : "rgba(255,255,255,0.04)",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  {insight.type === "warning" ? "⚠ " : "ℹ "}
                  {insight.title}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.9,
                  }}
                >
                  {insight.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            Leaderboard auditores ({selectedPeriod === "daily" ? "hoy" : selectedPeriod === "weekly" ? "semana" : "mes"})
          </div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Resumen por persona, ordenado por % de objetivo completado.
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>Cargando…</div>
            ) : leaderboard.length === 0 ? (
              <div style={{ opacity: 0.85 }}>No hay datos para este periodo.</div>
            ) : (
              leaderboard.map((row, idx) => (
                <div
                  key={row.auditor_user_id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 18,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        #{idx + 1} · {row.auditor_name}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        Auditorías: <b>{row.audits_done}</b> · Media:{" "}
                        <b>{row.avg_score !== null ? `${Number(row.avg_score).toFixed(1)}%` : "—"}</b>
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        Objetivo: <b>{row.targets_completed}</b> / {row.targets_total}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 800, fontSize: 20 }}>
                        {formatPct(row.progress_pct)}
                      </div>
                    </div>
                  </div>

                  <div style={progressTrackStyle}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, Number(row.progress_pct ?? 0)))}%`,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.45)",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Objetivos por auditor</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Resumen por persona y detalle por auditoría para cerrar {getPeriodLabel(selectedPeriod)}.
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>Cargando…</div>
            ) : groupedTargetsByAuditor.length === 0 ? (
              <div style={{ opacity: 0.85 }}>No hay objetivos para este periodo.</div>
            ) : (
              groupedTargetsByAuditor.map((group) => (
                <div
                  key={group.auditorUserId}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 18,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {group.auditor}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        Restan <b>{group.remainingSum}</b> · {group.completedSum}/{group.targetSum}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 800, fontSize: 20 }}>
                        {formatPct(group.progressPct)}
                      </div>
                    </div>
                  </div>

                  <div style={progressTrackStyle}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, Number(group.progressPct ?? 0)))}%`,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.45)",
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    {group.rows.map((row) => (
                      <div
                        key={row.target_id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 12,
                          padding: 10,
                          background: "rgba(255,255,255,0.04)",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            opacity: 0.95,
                          }}
                        >
                          {row.template}
                        </div>

                        <div style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
                          <div style={{ fontWeight: 700 }}>
                            {row.completed} / {row.target}
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 12 }}>
                            faltan <b>{row.remaining}</b>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Actividad reciente del equipo</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Últimas auditorías ejecutadas en {getPeriodLabel(selectedPeriod)} por tu equipo.
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>Cargando…</div>
            ) : teamRecentRuns.length === 0 ? (
              <div style={{ opacity: 0.85 }}>
                Aún no hay auditorías recientes del equipo.
              </div>
            ) : (
              teamRecentRuns.map((run) => (
                <div
                  key={run.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.12)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {run.auditor_name ?? "—"}
                      </div>
                      <div
                        style={{
                          opacity: 0.85,
                          fontSize: 13,
                          marginTop: 4,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {run.template_name ?? "Auditoría"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 700 }}>
                        {run.score !== null && run.score !== undefined
                          ? `${Number(run.score).toFixed(1)}%`
                          : "—"}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        {run.executed_at ? run.executed_at.replace("T", " ").slice(0, 16) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, ...card }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Configuración de objetivos</div>
            <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
              Ajusta el reparto por auditoría solo cuando necesites revisar o modificar la asignación.
            </div>
          </div>

          <button
            style={btn}
            onClick={() => setShowAssignmentsConfig((prev) => !prev)}
          >
            {showAssignmentsConfig ? "Ocultar configuración" : "Mostrar configuración"}
          </button>
        </div>

        {showAssignmentsConfig ? (
          <div style={{ marginTop: 14 }}>
            <TeamTargetAssignmentsCard card={card} hotelId={hotelId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}