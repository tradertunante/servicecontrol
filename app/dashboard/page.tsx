"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";

type Role = "admin" | "manager" | "auditor";

type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
};

type AuditTemplate = {
  id: string;
  name: string;
  active?: boolean | null;
  area_id: string;
};

type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  executed_at: string | null;
  audit_template_id: string;
  area_id: string;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "#000";
  if (score < 60) return "#c62828"; // rojo
  if (score < 80) return "#ef6c00"; // naranja
  return "#000"; // negro
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

type AvgStat = { avg: number | null; count: number };

function avgLastDaysWithCount(runs: AuditRunRow[], days: number): AvgStat {
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => {
      const t = r.executed_at ? new Date(r.executed_at).getTime() : 0;
      return t >= sinceMs;
    })
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n));

  if (vals.length === 0) return { avg: null, count: 0 };

  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

// Promedio estrictamente del mes actual (ej: febrero => solo febrero)
function avgCurrentMonthWithCount(runs: AuditRunRow[]): AvgStat {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11

  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => {
      const d = r.executed_at ? new Date(r.executed_at) : null;
      if (!d) return false;
      return d.getFullYear() === y && d.getMonth() === m;
    })
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n));

  if (vals.length === 0) return { avg: null, count: 0 };

  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

// Sparkline SVG (línea)
function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 34;
  const pad = 3;

  if (!values.length) {
    return (
      <div style={{ width: w, height: h, display: "flex", alignItems: "center", opacity: 0.6 }}>
        —
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return { x, y };
  });

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <div style={{ width: w, height: h, overflow: "hidden" }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="tendencia"
        style={{ display: "block" }}
      >
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}

type TemplateDash = {
  template_id: string;
  template_name: string;
  lastRun: AuditRunRow | null;

  avgWeek: number | null;
  weekCount: number;

  avgMonth: number | null;
  monthCount: number;

  trend: number[];
};

type AreaDash = {
  area: AreaRow;
  templates: AuditTemplate[];
  dashByTemplate: Record<string, TemplateDash>;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [q, setQ] = useState("");

  const [areaDash, setAreaDash] = useState<Record<string, AreaDash>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/login");
        if (!p) return;

        setProfile(p);

        if (!p?.hotel_id) {
          setAreas([]);
          setLoading(false);
          return;
        }

        // 1) Cargar áreas según rol (admin/manager: todas; auditor: asignadas)
        if (p.role === "admin" || p.role === "manager") {
          const { data, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id")
            .eq("hotel_id", p.hotel_id)
            .order("name", { ascending: true });

          if (aErr) throw aErr;
          setAreas((data ?? []) as AreaRow[]);
          setLoading(false);
          return;
        }

        // auditor
        const { data: accessData, error: accessErr } = await supabase
          .from("user_area_access")
          .select("area_id")
          .eq("user_id", p.id)
          .eq("hotel_id", p.hotel_id);

        if (accessErr) throw accessErr;

        const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);

        if (allowedIds.length === 0) {
          setAreas([]);
          setLoading(false);
          return;
        }

        const { data: areasData, error: areasErr } = await supabase
          .from("areas")
          .select("id,name,type,hotel_id")
          .eq("hotel_id", p.hotel_id)
          .in("id", allowedIds)
          .order("name", { ascending: true });

        if (areasErr) throw areasErr;

        setAreas((areasData ?? []) as AreaRow[]);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar el dashboard.");
        setLoading(false);
      }
    })();
  }, [router]);

  // 2) Cuando cambian áreas: cargar plantillas + runs por plantilla (SIN mezclar)
  useEffect(() => {
    (async () => {
      if (!profile?.hotel_id) return;
      if (areas.length === 0) return;

      setBusy(true);
      try {
        const areaIds = areas.map((a) => a.id);

        // 2.1) plantillas activas por área
        const { data: tplData, error: tplErr } = await supabase
          .from("audit_templates")
          .select("id,name,active,area_id")
          .in("area_id", areaIds)
          .order("name", { ascending: true });

        if (tplErr) throw tplErr;

        const templates = (tplData ?? [])
          .filter((t: any) => t.active !== false)
          .map((t: any) => ({ id: t.id, name: t.name, active: t.active, area_id: t.area_id })) as AuditTemplate[];

        // agrupar por área
        const templatesByArea: Record<string, AuditTemplate[]> = {};
        for (const t of templates) {
          if (!templatesByArea[t.area_id]) templatesByArea[t.area_id] = [];
          templatesByArea[t.area_id].push(t);
        }

        // 2.2) runs submitted con score para esas plantillas (cargamos un pool y luego agregamos)
        const tplIds = templates.map((t) => t.id);
        let runsPool: AuditRunRow[] = [];

        if (tplIds.length) {
          const { data: runData, error: runErr } = await supabase
            .from("audit_runs")
            .select("id,status,score,executed_at,audit_template_id,area_id")
            .in("audit_template_id", tplIds)
            .order("executed_at", { ascending: false })
            .limit(1200);

          if (runErr) throw runErr;

          runsPool = (runData ?? []) as AuditRunRow[];
        }

        const next: Record<string, AreaDash> = {};

        for (const a of areas) {
          const tpls = templatesByArea[a.id] ?? [];
          const dashByTemplate: Record<string, TemplateDash> = {};

          for (const t of tpls) {
            const runs = runsPool
              .filter((r) => r.audit_template_id === t.id)
              .filter((r) => (r.status ?? "").toLowerCase() === "submitted")
              .filter((r) => typeof r.score === "number" && r.executed_at);

            const sorted = [...runs].sort((x, y) => {
              const tx = x.executed_at ? new Date(x.executed_at).getTime() : 0;
              const ty = y.executed_at ? new Date(y.executed_at).getTime() : 0;
              return ty - tx;
            });

            const lastRun = sorted[0] ?? null;

            const wk = avgLastDaysWithCount(sorted, 7);
            const mo = avgCurrentMonthWithCount(sorted);

            const trendRuns = sorted.slice(0, 12).reverse();
            const trend = trendRuns
              .map((r) => Number(r.score))
              .filter((n) => Number.isFinite(n))
              .map((n) => clamp(n, 0, 100));

            dashByTemplate[t.id] = {
              template_id: t.id,
              template_name: t.name,
              lastRun,

              avgWeek: wk.avg,
              weekCount: wk.count,

              avgMonth: mo.avg,
              monthCount: mo.count,

              trend,
            };
          }

          next[a.id] = {
            area: a,
            templates: tpls,
            dashByTemplate,
          };
        }

        setAreaDash(next);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando datos del dashboard.");
      } finally {
        setBusy(false);
      }
    })();
  }, [areas, profile?.hotel_id]);

  const filteredAreas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return areas;
    return areas.filter((a) => `${a.name ?? ""}`.toLowerCase().includes(s));
  }, [areas, q]);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  // ✅ Botones superiores: TODOS como “Auditorías disponibles” (blancos)
  const btnTop: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
    whiteSpace: "nowrap",
  };

  // Mantengo por si lo usas en otros sitios
  const btnWhite: React.CSSProperties = btnTop;

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Dashboard general</h1>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 56, marginBottom: 6 }}>Dashboard general</h1>
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={() => window.location.reload()} style={btnTop}>
            Reintentar
          </button>
          <button onClick={() => router.push("/profile")} style={btnTop}>
            Perfil
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 56, marginBottom: 6 }}>Dashboard general</h1>
          <div style={{ opacity: 0.85 }}>
            Hola{profile?.full_name ? `, ${profile.full_name}` : ""}. Rol: <strong>{profile?.role}</strong> · Áreas:{" "}
            <strong>{areas.length}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {profile?.role === "admin" ? (
            <button onClick={() => router.push("/admin")} style={btnTop}>
              Admin
            </button>
          ) : null}

          {/* ✅ Renombrar y llevar a la ventana de auditorías disponibles */}
          <button onClick={() => router.push("/areas")} style={btnTop}>
            Auditar
          </button>

          <button onClick={() => router.push("/profile")} style={btnTop}>
            Perfil
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar área…"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.2)",
            outline: "none",
            fontWeight: 800,
          }}
        />
      </div>

      {busy ? <div style={{ marginTop: 12, opacity: 0.7 }}>Actualizando métricas…</div> : null}

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        {filteredAreas.map((a) => {
          const ad = areaDash[a.id];
          const templates = ad?.templates ?? [];

          return (
            <div key={a.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 1000, letterSpacing: -0.2 }}>{a.name}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => router.push(`/areas/${a.id}?tab=dashboard`)} style={btnWhite}>
                    Ver dashboard
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                {templates.length === 0 ? (
                  <div style={{ opacity: 0.75 }}>No hay plantillas activas en esta área.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ textAlign: "left" }}>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                            Auditoría
                          </th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                            Última auditoría
                          </th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                            Promedio 7 días
                          </th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                            Promedio del mes
                          </th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                            Tendencia
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {templates.map((t) => {
                          const d = ad?.dashByTemplate?.[t.id];
                          const last = d?.lastRun ?? null;

                          const week = d?.avgWeek ?? null;
                          const weekCount = d?.weekCount ?? 0;

                          const month = d?.avgMonth ?? null;
                          const monthCount = d?.monthCount ?? 0;

                          const trendColorBase = month ?? week;

                          return (
                            <tr key={t.id}>
                              <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                                <div style={{ fontWeight: 950 }}>{t.name}</div>
                              </td>

                              <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                                {last ? fmtDateTime(last.executed_at) : "—"}
                              </td>

                              <td
                                style={{
                                  padding: "10px 8px",
                                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                                  fontWeight: 950,
                                  color: scoreColor(week),
                                }}
                              >
                                {week === null ? "—" : `${Number(week).toFixed(2)}% (${weekCount})`}
                              </td>

                              <td
                                style={{
                                  padding: "10px 8px",
                                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                                  fontWeight: 950,
                                  color: scoreColor(month),
                                }}
                              >
                                {month === null ? "—" : `${Number(month).toFixed(2)}% (${monthCount})`}
                              </td>

                              <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                                <span style={{ color: scoreColor(trendColorBase), display: "inline-flex" }}>
                                  <Sparkline values={d?.trend ?? []} />
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredAreas.length === 0 ? (
          <div style={card}>
            {profile?.role === "auditor"
              ? "No tienes áreas asignadas. Pide a un admin que te habilite accesos."
              : "No hay áreas para mostrar."}
          </div>
        ) : null}
      </div>
    </main>
  );
}
