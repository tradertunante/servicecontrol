"use client";

import { useEffect, useState } from "react";
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

function getMonthScore(runs: AuditRunRow[], year: number, month: number) {
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

function getQuarterScore(runs: AuditRunRow[], year: number, quarter: number) {
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

function getYearScore(runs: AuditRunRow[], year: number) {
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

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);

  const [monthScore, setMonthScore] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });
  const [quarterScore, setQuarterScore] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });
  const [yearScore, setYearScore] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });

  const [heatMapData, setHeatMapData] = useState<any[]>([]);
  const [top3Areas, setTop3Areas] = useState<{ name: string; score: number; count: number }[]>([]);

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

        const month = getMonthScore(runsList, currentYear, currentMonth);
        const quarter = getQuarterScore(runsList, currentYear, currentQuarter);
        const year = getYearScore(runsList, currentYear);

        setMonthScore(month);
        setQuarterScore(quarter);
        setYearScore(year);

        const monthLabels: string[] = [];
        const heatData: any[] = [];

        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          monthLabels.push(
            d.toLocaleDateString("es-ES", { month: "short" }).charAt(0).toUpperCase() +
              d.toLocaleDateString("es-ES", { month: "short" }).slice(1, 3)
          );
        }

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

        const areaScores = areasList.map((area) => {
          const areaRuns = runsList.filter((r) => r.area_id === area.id);
          const score = getYearScore(areaRuns, currentYear);
          return {
            name: area.name,
            score: score.avg ?? 0,
            count: score.count,
          };
        });

        const top3 = areaScores
          .filter((a) => a.count > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        setTop3Areas(top3);

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

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      {/* Info del usuario - MÁS PEQUEÑA */}
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
          <GaugeChart
            value={quarterScore.avg ?? 0}
            label={`Q${getCurrentQuarter()} ${now.getFullYear()}`}
            count={quarterScore.count}
            size={180}
          />
        </div>

        <div style={card}>
          <GaugeChart
            value={yearScore.avg ?? 0}
            label={`Año ${now.getFullYear()}`}
            count={yearScore.count}
            size={180}
          />
        </div>
      </div>

      {/* Mapa de calor */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>
          Performance por área (últimos 12 meses)
        </div>
        {heatMapData.length > 0 ? (
          <HeatMap
            data={heatMapData}
            monthLabels={(() => {
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
            })()}
          />
        ) : (
          <div style={{ opacity: 0.7 }}>No hay datos suficientes para mostrar el mapa de calor.</div>
        )}
      </div>

      {/* Top 3 Áreas */}
      {top3Areas.length > 0 && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 16 }}>
            Top 3 Áreas con mejor performance ({now.getFullYear()})
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {top3Areas.map((area, idx) => {
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
              const color = area.score >= 80 ? "#2e7d32" : area.score >= 60 ? "#ef6c00" : "#c62828";

              return (
                <div
                  key={area.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{medal}</span>
                    <span style={{ fontWeight: 950, fontSize: 16 }}>{area.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, opacity: 0.7 }}>({area.count} auditorías)</span>
                    <span style={{ fontWeight: 950, fontSize: 20, color }}>{area.score.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
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