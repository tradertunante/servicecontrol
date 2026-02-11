"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { normalizeRole, canRunAudits } from "@/lib/auth/permissions";

// ----------------------
// Types
// ----------------------
type Role = "admin" | "manager" | "auditor";

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
};

type Area = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
  active?: boolean | null;
};

type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  notes: string | null;
  executed_at: string | null;
  executed_by: string | null;
  audit_template_id: string;
  area_id: string;
};

type AuditTemplateRow = { id: string; name: string };
type DashboardCard = {
  area: Area;

  // “submitted con score” si existe, sino fallback a lo que haya
  lastRun: AuditRunRow | null;

  avgScoreLast4: number | null;
  trendValues: number[]; // últimos 12 scores (0..100)
};

function fmtDate(iso: string | null) {
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

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Record<string, string>>({});
  const [cards, setCards] = useState<DashboardCard[]>([]);

  const [q, setQ] = useState("");

  // ----------------------
  // Load
  // ----------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/login");
        if (!p) return;

        const role = normalizeRole(p.role) as Role;
        const prof: Profile = {
          id: p.id,
          full_name: p.full_name ?? null,
          role,
          hotel_id: p.hotel_id ?? null,
        };
        setProfile(prof);

        // auditor -> va a su pantalla principal
        if (role === "auditor") {
          router.replace("/audits");
          return;
        }

        if (!canRunAudits(role)) {
          setError("No tienes permisos para acceder a esta sección.");
          setLoading(false);
          return;
        }

        if (!prof.hotel_id) {
          setAreas([]);
          setCards([]);
          setLoading(false);
          return;
        }

        // 1) Áreas del hotel
        const { data: aData, error: aErr } = await supabase
          .from("areas")
          .select("id,name,type,hotel_id,active")
          .eq("hotel_id", prof.hotel_id)
          .order("name", { ascending: true });

        if (aErr) throw aErr;

        const aList = ((aData ?? []) as Area[]).filter((a) => a.active !== false);
        setAreas(aList);

        const areaIds = aList.map((a) => a.id);
        if (areaIds.length === 0) {
          setCards([]);
          setLoading(false);
          return;
        }

        // 2) Runs de todas las áreas (batch)
        // Igual que en área: traemos hasta 80 por área aprox.
        // Para simplificar: pedimos un “pool” grande y agrupamos en memoria.
        const MAX_POOL = Math.min(2000, areaIds.length * 120);

        const { data: runData, error: runErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
          .in("area_id", areaIds)
          .order("executed_at", { ascending: false })
          .limit(MAX_POOL);

        if (runErr) throw runErr;

        const allRuns = (runData ?? []) as AuditRunRow[];

        // 3) Nombres de templates (para “última auditoría”)
        const templateIds = Array.from(new Set(allRuns.map((r) => r.audit_template_id).filter(Boolean)));
        if (templateIds.length) {
          const { data: tData, error: tErr } = await supabase
            .from("audit_templates")
            .select("id,name")
            .in("id", templateIds);

          if (tErr) throw tErr;

          const map: Record<string, string> = {};
          for (const row of (tData ?? []) as AuditTemplateRow[]) map[row.id] = row.name;
          setTemplateNameById(map);
        } else {
          setTemplateNameById({});
        }

        // 4) Construir cards con la MISMA lógica que dashboard por área
        // - submitted con score + executed_at
        // - si no hay submitted, fallback a allRuns del área
        const grouped: Record<string, AuditRunRow[]> = {};
        for (const r of allRuns) {
          if (!grouped[r.area_id]) grouped[r.area_id] = [];
          grouped[r.area_id].push(r);
        }

        const WINDOW = 4;

        const cardList: DashboardCard[] = aList.map((area) => {
          const areaRuns = grouped[area.id] ?? [];

          const submitted = areaRuns
            .filter((r) => (r.status ?? "").toLowerCase() === "submitted")
            .filter((r) => typeof r.score === "number" && r.executed_at);

          const sortedSubmitted = [...submitted].sort((a, b) => {
            const ta = a.executed_at ? new Date(a.executed_at).getTime() : 0;
            const tb = b.executed_at ? new Date(b.executed_at).getTime() : 0;
            return tb - ta;
          });

          const fallbackSortedAll = [...areaRuns].sort((a, b) => {
            const ta = a.executed_at ? new Date(a.executed_at).getTime() : 0;
            const tb = b.executed_at ? new Date(b.executed_at).getTime() : 0;
            return tb - ta;
          });

          const finalRuns = sortedSubmitted.length ? sortedSubmitted : fallbackSortedAll;
          const lastRun = finalRuns[0] ?? null;

          // promedio últimas 4 (solo si hay score)
          const scored = finalRuns.filter((r) => typeof r.score === "number" && r.executed_at);
          const last4 = scored.slice(0, WINDOW);
          const avgScoreLast4 =
            last4.length === 0
              ? null
              : Math.round((last4.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / last4.length) * 100) / 100;

          // tendencia últimos 12 (solo score)
          const trendRuns = scored.slice(0, 12).reverse();
          const trendValues = trendRuns
            .map((r) => Number(r.score))
            .filter((n) => Number.isFinite(n))
            .map((n) => clamp(n, 0, 100));

          return {
            area,
            lastRun,
            avgScoreLast4,
            trendValues,
          };
        });

        setCards(cardList);
        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando dashboard.");
      }
    })();
  }, [router]);

  const filteredCards = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cards;
    return cards.filter((c) => {
      const hay = `${c.area.name ?? ""} ${c.area.type ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [cards, q]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 18,
    boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
  };

  const btnBlack: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  const btnWhite: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 40, fontWeight: 950, marginBottom: 6 }}>Dashboard general</h1>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 40, fontWeight: 950, marginBottom: 6 }}>Dashboard general</h1>
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  const role = profile?.role ?? "manager";
  const areasCount = areas.length;

  return (
    <main style={{ padding: 24 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 40, fontWeight: 950, marginBottom: 6 }}>Dashboard general</h1>
          <div style={{ opacity: 0.8 }}>
            Hola, {profile?.full_name ?? "—"}. Rol: <b>{role}</b> · Áreas: <b>{areasCount}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {role === "admin" ? (
            <button style={btnBlack} onClick={() => router.push("/admin")}>
              Admin
            </button>
          ) : null}
          <button style={btnWhite} onClick={handleLogout}>
            Salir
          </button>
        </div>
      </div>

      {/* search */}
      <div style={{ marginTop: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar área…"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            outline: "none",
            fontWeight: 800,
            background: "#fff",
          }}
        />
      </div>

      {/* cards */}
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        {filteredCards.map((c) => {
          const r = c.lastRun;
          const lastScore = typeof r?.score === "number" ? Number(r.score) : null;
          const lastTplName = r ? templateNameById[r.audit_template_id] ?? r.audit_template_id : "—";

          return (
            <div key={c.area.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{c.area.name}</div>
                  <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>{c.area.type ?? "—"}</div>

                  <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                    <div style={{ opacity: 0.7 }}>Última auditoría:</div>
                    <div style={{ fontWeight: 900 }}>
                      {lastTplName} · {fmtDate(r?.executed_at ?? null)}
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.7 }}>Estado:</div>
                    <div style={{ fontWeight: 900 }}>{r?.status ?? "—"}</div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>Último score</div>
                  <div style={{ marginTop: 4, fontSize: 28, fontWeight: 950, color: scoreColor(lastScore) }}>
                    {lastScore === null ? "—" : `${lastScore.toFixed(2)}%`}
                  </div>

                  <div style={{ marginTop: 10, opacity: 0.85 }}>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>Promedio últimas 4</div>
                    <div style={{ fontWeight: 950, color: scoreColor(c.avgScoreLast4) }}>
                      {c.avgScoreLast4 === null ? "—" : `${c.avgScoreLast4.toFixed(2)}%`}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "inline-flex", color: scoreColor(c.avgScoreLast4) }}>
                    <Sparkline values={c.trendValues} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={btnBlack}
                  onClick={() => router.push(`/areas/${c.area.id}/start`)}
                >
                  Iniciar auditoría
                </button>

                <button
                  style={btnWhite}
                  onClick={() => router.push(`/areas/${c.area.id}?tab=history`)}
                >
                  Historial
                </button>

                <button
                  style={btnWhite}
                  onClick={() => router.push(`/areas/${c.area.id}?tab=dashboard`)}
                >
                  Ver dashboard
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCards.length === 0 ? (
        <div style={{ marginTop: 16, opacity: 0.8 }}>No hay áreas para mostrar.</div>
      ) : null}
    </main>
  );
}
