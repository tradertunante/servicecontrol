"use client";

import type { CSSProperties } from "react";
import type {
  MyPeriodKey,
  MySummary,
  MyTargetRow,
  RecentRunRow,
} from "../_hooks/useMyDashboardData";

function miniCard(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 12,
    background: "var(--card-bg)",
    width: "100%",
  };
}

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid var(--input-border)",
    borderRadius: 10,
    padding: "9px 11px",
    background: "rgba(0, 0, 0, 0.04)",
    cursor: "pointer",
    color: "var(--text)",
  };
}

function getPeriodLabel(period: MyPeriodKey) {
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

function formatScore(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.replace("T", " ").slice(0, 16);
  return d.toLocaleString();
}

export default function MySummaryView({
  loading,
  selectedPeriod,
  summary,
  myTargets,
  myRecentRuns,
  onOpenPlan,
}: {
  loading: boolean;
  selectedPeriod: MyPeriodKey;
  summary: MySummary;
  myTargets: MyTargetRow[];
  myRecentRuns: RecentRunRow[];
  onOpenPlan: () => void;
}) {
  const card = miniCard();
  const btn = buildBtnStyle();

  const progressTrackStyle: CSSProperties = {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    background: "rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Auditorías realizadas · {getPeriodLabel(selectedPeriod)}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {summary.totalAuditsDone}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Mi objetivo · {getPeriodLabel(selectedPeriod)}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {summary.totalCompletedTargets} / {summary.totalTargets}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Restantes · {getPeriodLabel(selectedPeriod)}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {summary.totalRemaining}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Progreso</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {formatPct(summary.globalPct)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Mi plan</div>
              <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>
                Preview de tus asignaciones.
              </div>
            </div>

            <button style={btn} onClick={onOpenPlan}>
              Ver todo
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {loading ? (
              <div style={{ opacity: 0.85 }}>Cargando…</div>
            ) : myTargets.length === 0 ? (
              <div style={{ opacity: 0.85 }}>No tienes objetivos propios para este periodo.</div>
            ) : (
              myTargets.slice(0, 3).map((row) => (
                <div
                  key={row.target_id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 12,
                    background: "var(--row-bg)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{row.template}</div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        {row.completed} / {row.target} · faltan {row.remaining}
                      </div>
                    </div>
                    <div style={{ fontWeight: 900 }}>{formatPct(row.progress_pct)}</div>
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
                        background: "var(--ok)",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Actividad reciente</div>
          <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>
            Últimas auditorías ejecutadas por ti.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {loading ? (
              <div style={{ opacity: 0.85 }}>Cargando…</div>
            ) : myRecentRuns.length === 0 ? (
              <div style={{ opacity: 0.85 }}>Aún no hay actividad reciente.</div>
            ) : (
              myRecentRuns.slice(0, 5).map((run) => (
                <div
                  key={run.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 12,
                    background: "var(--row-bg)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{run.template_name ?? "Auditoría"}</div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        {formatDateTime(run.executed_at)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800 }}>{formatScore(run.score)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
