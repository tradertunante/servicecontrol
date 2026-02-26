"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import GaugeChart from "@/app/components/GaugeChart";
import HeatMap from "@/app/components/HeatMap";

type Role = "admin" | "manager" | "auditor" | "superadmin";

type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

type HotelRow = { id: string; name: string; created_at?: string | null };
type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null; sort_order?: number | null };
type AuditRunRow = { id: string; status: string | null; score: number | null; executed_at: string | null; area_id: string; audit_template_id: string };
type ScoreAgg = { avg: number | null; count: number };
type AreaScore = { id: string; name: string; score: number; count: number };

const HOTEL_KEY = "sc_hotel_id";

function getMonthScore(runs: AuditRunRow[], year: number, month: number): ScoreAgg {
  const vals = runs
    .filter(r => r.executed_at)
    .filter(r => {
      const d = new Date(r.executed_at!);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .map(r => Number(r.score))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 100);

  if (!vals.length) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

function getYearScore(runs: AuditRunRow[], year: number): ScoreAgg {
  const vals = runs
    .filter(r => r.executed_at)
    .filter(r => new Date(r.executed_at!).getFullYear() === year)
    .map(r => Number(r.score))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 100);

  if (!vals.length) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

function scoreColor(score: number) {
  if (score < 60) return "#c62828";
  if (score < 80) return "#ef6c00";
  return "#0a7a3b";
}

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [monthScore, setMonthScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [yearScore, setYearScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [heatMapData, setHeatMapData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fg = "var(--text)";
  const bg = "var(--bg)";
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";
  const shadowSm = "0 4px 16px rgba(0,0,0,0.06)";

  const card: CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.92)",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    color: fg,
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await requireRoleOrRedirect(router, ["admin","manager","auditor","superadmin"], "/login") as Profile;
        if (!alive) return;
        setProfile(p);

        const hid = p.role === "superadmin"
          ? localStorage.getItem(HOTEL_KEY)
          : p.hotel_id;

        setSelectedHotelId(hid ?? null);

        if (!hid) {
          setLoading(false);
          return;
        }

        const { data: areasData } = await supabase
          .from("areas")
          .select("id,name,type,hotel_id,sort_order")
          .eq("hotel_id", hid)
          .order("name");

        const { data: runsData } = await supabase
          .from("audit_runs")
          .select("id,status,score,executed_at,area_id,audit_template_id")
          .eq("status","submitted")
          .eq("hotel_id", hid);

        const a = (areasData ?? []) as AreaRow[];
        const r = (runsData ?? []) as AuditRunRow[];

        setAreas(a);
        setRuns(r);

        const now = new Date();
        setMonthScore(getMonthScore(r, now.getFullYear(), now.getMonth()));
        setYearScore(getYearScore(r, now.getFullYear()));

        setHeatMapData([]);
        setLoading(false);
      } catch (e:any) {
        setError(e?.message ?? "Error");
        setLoading(false);
      }
    })();
    return () => { alive = false };
  }, [router]);

  if (loading) return <main style={{ padding: 24 }}>Cargando...</main>;
  if (error) return <main style={{ padding: 24, color: "red" }}>{error}</main>;

  const now = new Date();
  const monthName = now.toLocaleDateString("es-ES",{month:"long",year:"numeric"});

  return (
    <main style={{ padding: 24, background: bg, color: fg }}>
      <div style={{ marginBottom: 20 }}>
        Hola {profile?.full_name ?? ""} · Rol: <strong>{profile?.role}</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        <div style={card}>
          <GaugeChart value={monthScore.avg ?? 0} label={monthName} count={monthScore.count} size={180} />
        </div>
        <div style={card}>
          <GaugeChart value={yearScore.avg ?? 0} label={`Año ${now.getFullYear()}`} count={yearScore.count} size={180} />
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        {heatMapData.length > 0
          ? <HeatMap data={heatMapData} monthLabels={[]} />
          : <div>No hay datos suficientes.</div>}
      </div>

      {/* ✅ BOTONES INFERIORES */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginTop:20 }}>

        <button
          onClick={() => router.push("/areas")}
          style={{
            textAlign:"left",
            padding:16,
            borderRadius:14,
            border:`1px solid ${inputBorder}`,
            background:inputBg,
            color:fg,
            boxShadow:shadowSm,
            cursor:"pointer"
          }}
        >
          <div style={{ fontSize:16, fontWeight:900 }}>Ver todos los departamentos</div>
          <div style={{ marginTop:4, opacity:0.7, fontSize:13 }}>Explorar auditorías por departamento</div>
        </button>

        <button
          onClick={() => router.push("/team")}
          style={{
            textAlign:"left",
            padding:16,
            borderRadius:14,
            border:`1px solid ${inputBorder}`,
            background:inputBg,
            color:fg,
            boxShadow:shadowSm,
            cursor:"pointer"
          }}
        >
          <div style={{ fontSize:16, fontWeight:900 }}>Miembros del equipo</div>
          <div style={{ marginTop:4, opacity:0.7, fontSize:13 }}>Alta masiva y asignaciones</div>
        </button>

        <button
          onClick={() => router.push("/team/analytics")}
          style={{
            textAlign:"left",
            padding:16,
            borderRadius:14,
            border:`1px solid ${inputBorder}`,
            background:inputBg,
            color:fg,
            boxShadow:shadowSm,
            cursor:"pointer"
          }}
        >
          <div style={{ fontSize:16, fontWeight:900 }}>Analytics</div>
          <div style={{ marginTop:4, opacity:0.7, fontSize:13 }}>Ranking y formación conjunta</div>
        </button>

      </div>
    </main>
  );
}