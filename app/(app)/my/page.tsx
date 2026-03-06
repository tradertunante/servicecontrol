// FILE: app/(app)/my/page.tsx
"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { useMyDashboardData } from "./_hooks/useMyDashboardData";

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

export default function MyDashboardPage() {
  const router = useRouter();

  requireRoleOrRedirect(["superadmin", "admin", "manager", "quality", "auditor"], router);

  const card = useMemo(() => buildCardStyle(), []);
  const btn = useMemo(() => buildBtnStyle(), []);

  const { loading, profile, myTargetsToday, myTargetTasks, myRecentRuns, error } = useMyDashboardData();

  const role = profile?.role ?? "—";
  const fullName = profile?.full_name ?? "—";
  const isAuditor = role === "auditor";

  // ✅ Para roles no-auditor: agrupar por auditor para dirigir al equipo
  const targetsByAuditor = useMemo(() => {
    const map: Record<string, typeof myTargetsToday> = {};
    for (const t of myTargetsToday) {
      const key = (t.auditor ?? "—").trim() || "—";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    // Orden: quien más “restantes” tenga arriba (más urgencia)
    const entries = Object.entries(map).map(([auditor, rows]) => {
      const remainingSum = rows.reduce((acc, r) => acc + Number(r.remaining ?? 0), 0);
      const targetSum = rows.reduce((acc, r) => acc + Number(r.target ?? 0), 0);
      const completedSum = rows.reduce((acc, r) => acc + Number(r.completed ?? 0), 0);
      const pct = targetSum > 0 ? (completedSum / targetSum) * 100 : 0;
      return { auditor, rows, remainingSum, completedSum, targetSum, pct };
    });

    entries.sort((a, b) => b.remainingSum - a.remainingSum);
    return entries;
  }, [myTargetsToday]);

  return (
    <div style={{ padding: 18, width: "100%" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Mi panel</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Hola, <b>{fullName}</b> · Rol: <b>{role}</b>
          </div>
          <div style={{ opacity: 0.65, marginTop: 6, fontSize: 12 }}>
            Usa el menú superior para navegar (Admin · Auditar · Perfil).
          </div>
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
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          {/* Targets */}
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {isAuditor ? "Objetivos de hoy" : "Objetivos del equipo (hoy)"}
            </div>
            <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
              {isAuditor
                ? "Basado en tus audit_targets (period=daily) y tus auditorías de hoy."
                : "Basado en los audit_targets (period=daily) y auditorías ejecutadas hoy por cada auditor."}
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {myTargetsToday.length === 0 ? (
                <div style={{ opacity: 0.85 }}>
                  {isAuditor ? "No tienes objetivos diarios configurados." : "No hay objetivos diarios configurados para el equipo."}
                </div>
              ) : isAuditor ? (
                // ✅ Vista auditor (como antes, pero sin confundir a manager)
                myTargetsToday.map((t) => (
                  <div
                    key={t.target_id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.12)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 650 }}>{t.template}</div>
                      <div style={{ opacity: 0.85 }}>
                        <b>{t.completed}</b> / {t.target} · {formatPct(t.progress_pct)}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(0, Math.min(100, Number(t.progress_pct ?? 0)))}%`,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.45)",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        opacity: 0.85,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div>
                        Restantes: <b>{t.remaining}</b>
                      </div>

                      <button style={btn} onClick={() => router.push("/templates")}>
                        Auditar
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                // ✅ Vista manager/quality/admin/superadmin: agrupado por auditor
                targetsByAuditor.map((g) => (
                  <div
                    key={g.auditor}
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.12)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {g.auditor}
                      </div>
                      <div style={{ opacity: 0.85 }}>
                        <b>{g.completedSum}</b> / {g.targetSum} · {formatPct(g.pct)}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(0, Math.min(100, Number(g.pct ?? 0)))}%`,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.45)",
                        }}
                      />
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                      Restantes hoy: <b>{g.remainingSum}</b>
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {g.rows.map((t) => (
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
                          <div style={{ opacity: 0.9, whiteSpace: "nowrap" }}>
                            <b>{t.completed}</b>/{t.target} · faltan <b>{t.remaining}</b>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <button style={btn} onClick={() => router.push("/dashboard")}>
                        Ver dashboard
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tasks */}
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Mis tareas</div>
            <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
              task_type = <b>target</b> y asignadas a ti.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {myTargetTasks.length === 0 ? (
                <div style={{ opacity: 0.85 }}>No hay tareas pendientes ahora mismo.</div>
              ) : (
                myTargetTasks.map((x) => (
                  <div
                    key={x.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {x.title}
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                        Estado: <b>{x.status}</b> · Vence: <b>{x.due_date?.slice(0, 10) ?? "—"}</b>
                      </div>
                    </div>
                    <button style={btn} onClick={() => router.push("/tasks")}>
                      Ver
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Mi actividad reciente</div>
            <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
              Últimas auditorías ejecutadas por ti.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {myRecentRuns.length === 0 ? (
                <div style={{ opacity: 0.85 }}>Aún no hay auditorías recientes.</div>
              ) : (
                myRecentRuns.map((r) => (
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
                      <div style={{ fontWeight: 650, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.template_name ?? "Auditoría"}
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
      )}
    </div>
  );
}