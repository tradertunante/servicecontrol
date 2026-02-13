"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import HotelHeader from "@/app/components/HotelHeader";
import GaugeChart from "@/app/components/GaugeChart";
import HeatMap from "@/app/components/HeatMap";

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

type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  executed_at: string | null;
  area_id: string;
};

type ScoreAgg = { avg: number | null; count: number };

type AreaScore = {
  id: string;
  name: string;
  score: number;
  count: number;
};

type TrendPoint = {
  key: string; // e.g. "Feb"
  monthIndex: number;
  year: number;
  avg: number | null;
  count: number;
};

type WorstRun = {
  id: string;
  area_id: string;
  area_name: string;
  score: number;
  executed_at: string | null;
};

function getMonthScore(runs: AuditRunRow[], year: number, month: number): ScoreAgg {
  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => {
      const d = new Date(r.executed_at!);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

function getQuarterScore(runs: AuditRunRow[], year: number, quarter: number): ScoreAgg {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;

  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => {
      const d = new Date(r.executed_at!);
      const m = d.getMonth();
      return d.getFullYear() === year && m >= startMonth && m <= endMonth;
    })
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

function getYearScore(runs: AuditRunRow[], year: number): ScoreAgg {
  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => new Date(r.executed_at!).getFullYear() === year)
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

function getCurrentQuarter(): number {
  const month = new Date().getMonth();
  return Math.floor(month / 3) + 1;
}

function scoreColor(score: number) {
  // rojo <60, naranja 60-80, negro 80-100
  if (score < 60) return "#c62828";
  if (score < 80) return "#ef6c00";
  return "#111";
}

function formatMonthKey(d: Date) {
  const s = d
    .toLocaleDateString("es-ES", { month: "short" })
    .replace(".", "")
    .slice(0, 3);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateTime(iso: string | null) {
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

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);

  const [monthScore, setMonthScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [quarterScore, setQuarterScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [yearScore, setYearScore] = useState<ScoreAgg>({ avg: null, count: 0 });

  const [heatMapData, setHeatMapData] = useState<any[]>([]);

  const [top3Areas, setTop3Areas] = useState<AreaScore[]>([]);
  const [worst3Areas, setWorst3Areas] = useState<AreaScore[]>([]);
  const [worst3Runs, setWorst3Runs] = useState<WorstRun[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/login");
        if (!p) return;

        setProfile(p);

        if (!p?.hotel_id) {
          setLoading(false);
          return;
        }

        let areasList: AreaRow[] = [];
        if (p.role === "admin" || p.role === "manager") {
          const { data, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id")
            .eq("hotel_id", p.hotel_id)
            .order("name", { ascending: true });

          if (aErr) throw aErr;
          areasList = (data ?? []) as AreaRow[];
        } else {
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", p.id)
            .eq("hotel_id", p.hotel_id);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);

          if (allowedIds.length > 0) {
            const { data: areasData, error: areasErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id")
              .eq("hotel_id", p.hotel_id)
              .in("id", allowedIds)
              .order("name", { ascending: true });

            if (areasErr) throw areasErr;
            areasList = (areasData ?? []) as AreaRow[];
          }
        }

        setAreas(areasList);

        const areaIds = areasList.map((a) => a.id);
        if (areaIds.length === 0) {
          setLoading(false);
          return;
        }

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const { data: runsData, error: runsErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,executed_at,area_id")
          .in("area_id", areaIds)
          .eq("status", "submitted")
          .gte("executed_at", oneYearAgo.toISOString())
          .order("executed_at", { ascending: false });

        if (runsErr) throw runsErr;

        const runsList = (runsData ?? []) as AuditRunRow[];
        setRuns(runsList);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentQuarter = getCurrentQuarter();

        setMonthScore(getMonthScore(runsList, currentYear, currentMonth));
        setQuarterScore(getQuarterScore(runsList, currentYear, currentQuarter));
        setYearScore(getYearScore(runsList, currentYear));

        // Heatmap (12 meses)
        const heatData: any[] = [];
        for (const area of areasList) {
          const areaRuns = runsList.filter((r) => r.area_id === area.id);
          const months: any[] = [];

          for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const y = d.getFullYear();
            const m = d.getMonth();

            const score = getMonthScore(areaRuns, y, m);
            months.push({ value: score.avg, count: score.count });
          }

          heatData.push({
            areaName: area.name,
            months,
          });
        }
        setHeatMapData(heatData);

        // Area scores año actual
        const areaScores: AreaScore[] = areasList.map((area) => {
          const areaRuns = runsList.filter((r) => r.area_id === area.id);
          const score = getYearScore(areaRuns, currentYear);
          return {
            id: area.id,
            name: area.name,
            score: score.avg ?? 0,
            count: score.count,
          };
        });

        const withData = areaScores.filter((a) => a.count > 0);

        setTop3Areas([...withData].sort((a, b) => b.score - a.score).slice(0, 3));
        setWorst3Areas([...withData].sort((a, b) => a.score - b.score).slice(0, 3));

        // Top 3 auditorías peores (runs individuales)
        const areaNameById = new Map(areasList.map((a) => [a.id, a.name] as const));
        const worstRuns: WorstRun[] = [...runsList]
          .filter((r) => r.score !== null && Number.isFinite(Number(r.score)))
          .map((r) => ({
            id: r.id,
            area_id: r.area_id,
            area_name: areaNameById.get(r.area_id) ?? "Área",
            score: Number(r.score),
            executed_at: r.executed_at,
          }))
          .sort((a, b) => a.score - b.score)
          .slice(0, 3);

        setWorst3Runs(worstRuns);

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar el dashboard.");
        setLoading(false);
      }
    })();
  }, [router]);

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const miniBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
    whiteSpace: "nowrap",
  };

  const goAreaDetail = (areaId: string) => {
    router.push(`/areas/${areaId}/history`);
  };

  const build3MonthTrend = (areaId: string): TrendPoint[] => {
    const areaRuns = runs.filter((r) => r.area_id === areaId);
    const points: TrendPoint[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const s = getMonthScore(areaRuns, year, monthIndex);
      points.push({
        key: formatMonthKey(d),
        monthIndex,
        year,
        avg: s.avg,
        count: s.count,
      });
    }
    return points;
  };

  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      labels.push(
        d.toLocaleDateString("es-ES", { month: "short" }).charAt(0).toUpperCase() +
          d.toLocaleDateString("es-ES", { month: "short" }).slice(1, 3)
      );
    }
    return labels;
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <div style={{ opacity: 0.8 }}>Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <div style={{ color: "crimson", fontWeight: 900 }}>{error}</div>
      </main>
    );
  }

  const now = new Date();
  const monthName = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const renderAreaRow = (area: AreaScore, idx: number, kind: "best" | "worst") => {
    const badge = kind === "best" ? (idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉") : "⚠️";
    const color = scoreColor(area.score);
    const trend = build3MonthTrend(area.id);

    return (
      <div
        key={area.id}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(0,0,0,0.02)",
          border: "1px solid rgba(0,0,0,0.08)",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 22, lineHeight: "22px" }}>{badge}</span>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
              {area.name}
            </div>

            {/* Tendencia 3 meses */}
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 10, opacity: 0.85 }}>
              <span style={{ fontSize: 12, fontWeight: 900 }}>Tendencia 3 meses:</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {trend.map((t) => (
                  <span key={`${t.key}-${t.year}-${t.monthIndex}`} style={{ fontSize: 12 }}>
                    <strong>{t.key}</strong>{" "}
                    <span style={{ color: t.avg === null ? "#666" : scoreColor(t.avg ?? 0), fontWeight: 950 }}>
                      {t.avg === null ? "—" : `${(t.avg ?? 0).toFixed(1)}%`}
                    </span>{" "}
                    <span style={{ opacity: 0.65 }}>({t.count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>({area.count} auditorías)</span>
          <span style={{ fontWeight: 950, fontSize: 20, color }}>{area.score.toFixed(1)}%</span>
          <button onClick={() => goAreaDetail(area.id)} style={miniBtn}>
            Ver detalle
          </button>
        </div>
      </div>
    );
  };

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      {/* Info del usuario */}
      <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 20 }}>
        Hola{profile?.full_name ? `, ${profile.full_name}` : ""}. Rol: <strong>{profile?.role}</strong> · Áreas:{" "}
        <strong>{areas.length}</strong>
      </div>

      {/* Gauges */}
      <div
        style={{
          marginTop: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <div style={card}>
          <GaugeChart
            value={monthScore.avg ?? 0}
            label={monthName.charAt(0).toUpperCase() + monthName.slice(1)}
            count={monthScore.count}
            size={180}
          />
        </div>

        <div style={card}>
          <GaugeChart value={quarterScore.avg ?? 0} label={`Q${getCurrentQuarter()} ${now.getFullYear()}`} count={quarterScore.count} size={180} />
        </div>

        <div style={card}>
          <GaugeChart value={yearScore.avg ?? 0} label={`Año ${now.getFullYear()}`} count={yearScore.count} size={180} />
        </div>
      </div>

      {/* Mapa de calor */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>Performance por área (últimos 12 meses)</div>
        {heatMapData.length > 0 ? (
          <HeatMap data={heatMapData} monthLabels={monthLabels} />
        ) : (
          <div style={{ opacity: 0.7 }}>No hay datos suficientes para mostrar el mapa de calor.</div>
        )}
      </div>

      {/* Mejores vs Peores */}
      {(top3Areas.length > 0 || worst3Areas.length > 0) && (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {/* Top 3 mejores */}
          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>
              Top 3 Áreas con mejor performance ({now.getFullYear()})
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {top3Areas.length > 0 ? (
                top3Areas.map((a, idx) => renderAreaRow(a, idx, "best"))
              ) : (
                <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
              )}
            </div>
          </div>

          {/* Top 3 peores */}
          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>
              Top 3 Áreas con peor performance ({now.getFullYear()})
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {worst3Areas.length > 0 ? (
                worst3Areas.map((a, idx) => renderAreaRow(a, idx, "worst"))
              ) : (
                <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top 3 auditorías peores */}
      {worst3Runs.length > 0 && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>Top 3 auditorías con peor resultado</div>

          <div style={{ display: "grid", gap: 12 }}>
            {worst3Runs.map((r, idx) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 22 }}>{idx === 0 ? "🚨" : "⚠️"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.area_name}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                      Ejecutada: <strong>{formatDateTime(r.executed_at)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 950, fontSize: 20, color: scoreColor(r.score) }}>{r.score.toFixed(1)}%</span>
                  <button onClick={() => goAreaDetail(r.area_id)} style={miniBtn}>
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acceso rápido */}
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <button
          onClick={() => router.push("/areas")}
          style={{
            textAlign: "left",
            padding: 16,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "#fff",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900 }}>Ver todas las áreas</div>
          <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>Explorar auditorías por área</div>
        </button>

        {profile?.role === "admin" && (
          <button
            onClick={() => router.push("/builder")}
            style={{
              textAlign: "left",
              padding: 16,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900 }}>Builder</div>
            <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>Crear y editar auditorías</div>
          </button>
        )}
      </div>
    </main>
  );
}
