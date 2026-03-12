"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import TeamTargetAssignmentsCard from "./TeamTargetAssignmentsCard";
import { useTeamData, type TeamPeriodKey } from "../_hooks/useTeamData";

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

export default function TeamSummaryTab({
  selectedPeriod,
  hotelId,
}: {
  selectedPeriod: TeamPeriodKey;
  hotelId: string;
}) {
  const [showAssignmentsConfig, setShowAssignmentsConfig] = useState(false);
  const { loading, error, leaderboard, teamTargets, teamRecentRuns, summary } =
    useTeamData(selectedPeriod);

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
    } else if (summary.totalTargets > 0) {
      const ratio = summary.totalRemaining / summary.totalTargets;

      if (ratio > 0.7) {
        list.push({
          type: "warning",
          title: "Retraso en objetivos",
          text: "Queda más del 70% del objetivo del periodo por completar.",
        });
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

  const progressTrackStyle: React.CSSProperties = {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    background: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  };

  const panelBodyStyle: React.CSSProperties = {
    marginTop: 10,
    display: "grid",
    gap: 10,
    maxHeight: 620,
    overflowY: "auto",
    paddingRight: 4,
    alignContent: "start",
  };

  const btn: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "9px 11px",
    background: "var(--card-bg)",
    color: "rgba(15,23,42,0.82)",
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
  };

  return (
    <>
      {error ? (
        <Card style={{ marginTop: 14, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {error}
        </Card>
      ) : null}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <Card>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Auditorías equipo · {getPeriodLabel(selectedPeriod)}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {summary.totalAuditsDone}
          </div>
        </Card>

        <Card>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Objetivo total · {getPeriodLabel(selectedPeriod)}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {summary.totalCompletedTargets} / {summary.totalTargets}
          </div>
        </Card>

        <Card>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Restantes · {getPeriodLabel(selectedPeriod)}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {summary.totalRemaining}
          </div>
        </Card>

        <Card>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Progreso global</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {formatPct(summary.globalPct)}
          </div>
        </Card>
      </div>

      {insights.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Insights del sistema</div>

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
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  background:
                    insight.type === "warning"
                      ? "rgba(255,180,0,0.08)"
                      : "var(--card-bg)",
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
        </Card>
      )}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            Leaderboard auditores (
            {selectedPeriod === "daily"
              ? "hoy"
              : selectedPeriod === "weekly"
                ? "semana"
                : "mes"}
            )
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
                <Card key={row.auditor_user_id} padding={12}>
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
                        <b>
                          {row.avg_score !== null
                            ? `${Number(row.avg_score).toFixed(1)}%`
                            : "—"}
                        </b>
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
                        width: `${Math.max(
                          0,
                          Math.min(100, Number(row.progress_pct ?? 0))
                        )}%`,
                        borderRadius: 999,
                        background: "linear-gradient(90deg,#60a5fa,#38bdf8)",
                      }}
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Objetivos por auditor</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Resumen por persona y detalle por auditoría para cerrar{" "}
            {getPeriodLabel(selectedPeriod)}.
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>Cargando…</div>
            ) : groupedTargetsByAuditor.length === 0 ? (
              <div style={{ opacity: 0.85 }}>No hay objetivos para este periodo.</div>
            ) : (
              groupedTargetsByAuditor.map((group) => (
                <Card key={group.auditorUserId} padding={12}>
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
                        Restan <b>{group.remainingSum}</b> · {group.completedSum}/
                        {group.targetSum}
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
                        width: `${Math.max(
                          0,
                          Math.min(100, Number(group.progressPct ?? 0))
                        )}%`,
                        borderRadius: 999,
                        background: "linear-gradient(90deg,#60a5fa,#38bdf8)",
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    {group.rows.map((row) => (
                      <Card
                        key={row.target_id}
                        padding={10}
                        radius={12}
                        shadow="none"
                        style={{
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

                        <div
                          style={{
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>
                            {row.completed} / {row.target}
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 12 }}>
                            faltan <b>{row.remaining}</b>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>

        <Card>
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
                <Card key={run.id} padding={12}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
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
                        {run.executed_at
                          ? run.executed_at.replace("T", " ").slice(0, 16)
                          : "—"}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 14 }}>
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
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Configuración de objetivos
            </div>
            <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
              Ajusta el reparto por auditoría solo cuando necesites revisar o modificar la
              asignación.
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
            <TeamTargetAssignmentsCard
              card={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 14,
                background: "var(--card-bg)",
                boxShadow: "var(--shadow-sm)",
              }}
              hotelId={hotelId}
            />
          </div>
        ) : null}
      </Card>
    </>
  );
}
