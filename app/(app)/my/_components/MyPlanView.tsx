"use client";

import type { CSSProperties } from "react";
import type { MyTargetRow } from "../_hooks/useMyDashboardData";

function miniCard(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
    background: "var(--card-bg)",
    width: "100%",
  };
}

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid var(--input-border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(0, 0, 0, 0.04)",
    cursor: "pointer",
    color: "var(--text)",
  };
}

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(0)}%`;
}

export default function MyPlanView({
  loading,
  myTargets,
  onAuditTemplate,
}: {
  loading: boolean;
  myTargets: MyTargetRow[];
  onAuditTemplate: (templateId: string) => void;
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
        <div style={card}>No tienes objetivos propios para este periodo.</div>
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 17 }}>{row.template}</div>
                <div style={{ opacity: 0.82, fontSize: 13, marginTop: 6 }}>
                  {row.completed} / {row.target} completadas · faltan {row.remaining}
                </div>
              </div>

              <div style={{ fontWeight: 900, fontSize: 20 }}>
                {formatPct(row.progress_pct)}
              </div>
            </div>

            <div style={progressTrackStyle}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, Number(row.progress_pct ?? 0)))}%`,
                  borderRadius: 999,
                  background: "var(--ok)",
                }}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button style={btn} onClick={() => onAuditTemplate(row.target_id)}>
                Auditar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}