// FILE: app/(app)/team/page.tsx
"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { useTeamData } from "./_hooks/useTeamData";

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

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(0)}%`;
}

function getStatusLabel(progressPct: number) {
  if (progressPct >= 100) return "Completo";
  if (progressPct > 0) return "En progreso";
  return "Sin empezar";
}

export default function TeamPage() {
  const router = useRouter();

  requireRoleOrRedirect(["superadmin", "admin", "manager", "quality"], router);

  const card = useMemo(() => buildCardStyle(), []);
  const btn = useMemo(() => buildBtnStyle(), []);

  const { loading, error, profile, leaderboard, teamTargets, teamRecentRuns, summary } = useTeamData();

  const groupedTargets = useMemo(() => {
    const map: Record<string, typeof teamTargets> = {};
    for (const row of teamTargets) {
      const key = row.auditor_user_id ?? "—";
      if (!map[key]) map[key] = [];
      map[key].push(row);
    }
    return map;
  }, [teamTargets]);

  return (
    <div style={{ padding: 18, width: "100%" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Equipo</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Hola, <b>{profile?.full_name ?? "—"}</b> · Rol: <b>{profile?.role ?? "—"}</b>
          </div>
          <div style={{ opacity: 0.65, marginTop: 6, fontSize: 12 }}>
            Panel operativo del equipo y seguimiento diario de objetivos.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btn} onClick={() => router.push("/dashboard")}>
            Dashboard
          </button>
          <button style={btn} onClick={() => router.push("/admin")}>
            Admin
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 14, ...card, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 14, ...card }}>Cargando…</div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {/* Resumen */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div style={card}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Auditorías equipo hoy</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{summary.totalAuditsDone}</div>
            </div>

            <div style={card}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Objetivo total hoy</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                {summary.totalCompletedTargets} / {summary.totalTargets}
              </div>
            </div>

            <div style={card}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Restantes hoy</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{summary.totalRemaining}</div>
            </div>

            <div style={card}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Progreso global</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{formatPct(summary.globalPct)}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 420px) 1fr 1fr",
              gap: 14,
              alignItems: "start",
            }}
          >
            {/* Leaderboard */}
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Leaderboard auditores (hoy)</div>
              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                Ordenado por % de objetivo completado.
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {leaderboard.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>No hay datos aún para hoy.</div>
                ) : (
                  leaderboard.map((x, idx) => (
                    <div
                      key={x.auditor_user_id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(0,0,0,0.12)",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 700 }}>
                          #{idx + 1} · {x.auditor_name}
                        </div>
                        <div style={{ opacity: 0.85 }}>
                          <b>{formatPct(x.progress_pct)}</b>
                        </div>
                      </div>

                      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(0, Math.min(100, Number(x.progress_pct ?? 0)))}%`,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.45)",
                          }}
                        />
                      </div>

                      <div style={{ opacity: 0.9, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <b>{x.targets_completed}</b> / {x.targets_total} · faltan <b>{x.remaining}</b>
                        </div>
                        <div>
                          Audits: <b>{x.audits_done}</b>
                          {x.avg_score !== null ? (
                            <>
                              {" "}· Score: <b>{Number(x.avg_score).toFixed(1)}%</b>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ opacity: 0.75, fontSize: 12 }}>
                        Estado: <b>{getStatusLabel(Number(x.progress_pct ?? 0))}</b>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Objetivos por auditor */}
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Objetivos por auditor</div>
              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                Qué le falta a cada uno para cerrar el día.
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                {leaderboard.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>No hay objetivos cargados hoy.</div>
                ) : (
                  leaderboard.map((person) => {
                    const rows = groupedTargets[person.auditor_user_id] ?? [];

                    return (
                      <div
                        key={person.auditor_user_id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 14,
                          padding: 12,
                          background: "rgba(0,0,0,0.12)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 700 }}>{person.auditor_name}</div>
                          <div style={{ opacity: 0.85 }}>
                            <b>{person.targets_completed}</b> / {person.targets_total}
                          </div>
                        </div>

                        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                          Restantes hoy: <b>{person.remaining}</b>
                        </div>

                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          {rows.length === 0 ? (
                            <div style={{ opacity: 0.7, fontSize: 13 }}>No hay detalle por plantilla.</div>
                          ) : (
                            rows.map((t) => (
                              <div
                                key={t.target_id}
                                style={{
                                  border: "1px solid rgba(255,255,255,0.10)",
                                  borderRadius: 12,
                                  padding: 10,
                                  background: "rgba(255,255,255,0.04)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {t.template}
                                </div>
                                <div style={{ whiteSpace: "nowrap", opacity: 0.9 }}>
                                  <b>{t.completed}</b>/{t.target} · faltan <b>{t.remaining}</b>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Actividad reciente */}
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Actividad reciente del equipo</div>
              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
                Últimas auditorías ejecutadas hoy por tu equipo.
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {teamRecentRuns.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>Aún no hay auditorías recientes del equipo.</div>
                ) : (
                  teamRecentRuns.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(0,0,0,0.12)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.template_name ?? "Auditoría"}
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                            {r.auditor_name ?? "—"}
                          </div>
                        </div>

                        <div style={{ opacity: 0.85 }}>
                          {r.score !== null && r.score !== undefined ? <b>{Number(r.score).toFixed(1)}%</b> : "—"}
                        </div>
                      </div>

                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        {r.executed_at ? r.executed_at.replace("T", " ").slice(0, 16) : "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}