// FILE: app/(app)/my/page.tsx
"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { useMyDashboardData, type MyPeriodKey } from "./_hooks/useMyDashboardData";

function buildCardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.20)",
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

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    cursor: "pointer",
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

export default function MyDashboardPage() {
  const router = useRouter();
  requireRoleOrRedirect(["superadmin", "admin", "manager", "quality", "auditor"], router);

  const card = useMemo(() => buildCardStyle(), []);
  const input = useMemo(() => buildInputStyle(), []);
  const btn = useMemo(() => buildBtnStyle(), []);

  const [selectedPeriod, setSelectedPeriod] = useState<MyPeriodKey>("monthly");

  const { loading, error, profile, myTargets, myRecentRuns, summary } =
    useMyDashboardData(selectedPeriod);

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
          <div style={{ fontSize: 22, fontWeight: 700 }}>Mi panel</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Hola, <b>{profile?.full_name ?? "—"}</b> · Rol: <b>{profile?.role ?? "—"}</b>
          </div>
          <div style={{ opacity: 0.65, marginTop: 6, fontSize: 12 }}>
            Resumen personal de auditorías y seguimiento de objetivos.
          </div>
        </div>

        <div style={{ minWidth: 220 }}>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo</div>
          <select
            style={input}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as MyPeriodKey)}
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
          <div style={{ opacity: 0.8, fontSize: 13 }}>Auditorías realizadas · {getPeriodLabel(selectedPeriod)}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{summary.totalAuditsDone}</div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Mi objetivo · {getPeriodLabel(selectedPeriod)}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>
            {summary.totalCompletedTargets} / {summary.totalTargets}
          </div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Restantes · {getPeriodLabel(selectedPeriod)}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{summary.totalRemaining}</div>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Progreso</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{formatPct(summary.globalPct)}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 14,
        }}
      >
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Mis auditorías pendientes</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Tus auditorías asignadas para cerrar {getPeriodLabel(selectedPeriod)}.
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>Cargando…</div>
            ) : myTargets.length === 0 ? (
              <div style={{ opacity: 0.85 }}>No tienes objetivos para este periodo.</div>
            ) : (
              myTargets.map((row) => (
                <div
                  key={row.target_id}
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
                        {row.template}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        <b>{row.completed}</b> / {row.target} completadas · faltan <b>{row.remaining}</b>
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
                        background: "rgba(255,255,255,0.7)",
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      style={btn}
                      onClick={() =>
                        router.push(`/audits/new?template=${encodeURIComponent(row.target_id)}`)
                      }
                    >
                      Auditar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Mis auditorías recientes</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
            Últimas auditorías ejecutadas por ti en {getPeriodLabel(selectedPeriod)}.
          </div>

          <div style={panelBodyStyle}>
            {loading ? (
              <div>Cargando…</div>
            ) : myRecentRuns.length === 0 ? (
              <div style={{ opacity: 0.85 }}>Aún no hay auditorías recientes.</div>
            ) : (
              myRecentRuns.map((run) => (
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
                        {run.template_name ?? "Auditoría"}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        {run.executed_at ? run.executed_at.replace("T", " ").slice(0, 16) : "—"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 700 }}>
                        {run.score !== null && run.score !== undefined ? `${Number(run.score).toFixed(1)}%` : "—"}
                      </div>
                    </div>
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