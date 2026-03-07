"use client";

import type { CSSProperties } from "react";
import type { MySummary, MyTargetRow } from "../_hooks/useMyDashboardData";

function miniCard(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
    background: "var(--card-bg)",
    width: "100%",
  };
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

export default function MyPerformanceView({
  loading,
  summary,
  myTargets,
}: {
  loading: boolean;
  summary: MySummary;
  myTargets: MyTargetRow[];
}) {
  const card = miniCard();

  const progressTrackStyle: CSSProperties = {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    background: "rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Cumplimiento</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
            {formatPct(summary.globalPct)}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Score medio</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
            {formatScore(summary.averageScore)}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Ejecutadas</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
            {summary.totalAuditsDone}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Pendientes</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
            {summary.totalRemaining}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 14,
        }}
      >
        {loading ? (
          <div style={card}>Cargando…</div>
        ) : myTargets.length === 0 ? (
          <div style={card}>No tienes datos de rendimiento para este periodo.</div>
        ) : (
          myTargets.map((row) => (
            <div key={row.target_id} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{row.template}</div>
                  <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                    {row.completed} / {row.target} · restantes {row.remaining}
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
  );
}