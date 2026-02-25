// FILE: app/(app)/dashboard/page.tsx
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

type HotelRow = {
  id: string;
  name: string;
  created_at?: string | null;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null; // lo usas como "Grupo" (ROOMS / A&B / SPA)
  hotel_id: string | null;
  sort_order?: number | null; // <-- este manda el orden
};

type AuditRunRow = {
  id: string;
  status: string | null;
  score: number | null;
  executed_at: string | null;
  area_id: string;
  audit_template_id: string;
};

type ScoreAgg = { avg: number | null; count: number };

type AreaScore = {
  id: string;
  name: string;
  score: number;
  count: number;
};

type TrendPoint = {
  key: string;
  monthIndex: number;
  year: number;
  avg: number | null;
  count: number;
};

type WorstAudit = {
  id: string; // templateId
  areaId: string;
  name: string;
  avg: number;
  count: number;
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
  if (score < 60) return "var(--danger, #c62828)";
  if (score < 80) return "var(--warn, #ef6c00)";
  return "var(--ok, #0a7a3b)";
}

function formatMonthKey(d: Date) {
  const s = d
    .toLocaleDateString("es-ES", { month: "short" })
    .replace(".", "")
    .slice(0, 3);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const HOTEL_KEY = "sc_hotel_id";

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);

  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);

  const [monthScore, setMonthScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [quarterScore, setQuarterScore] = useState<ScoreAgg>({ avg: null, count: 0 });
  const [yearScore, setYearScore] = useState<ScoreAgg>({ avg: null, count: 0 });

  const [heatMapData, setHeatMapData] = useState<any[]>([]);

  const [top3Areas, setTop3Areas] = useState<AreaScore[]>([]);
  const [worst3Areas, setWorst3Areas] = useState<AreaScore[]>([]);
  const [worst3Audits, setWorst3Audits] = useState<WorstAudit[]>([]);

  const fg = "var(--text)";
  const bg = "var(--bg)";
  const inputBg = "var(--input-bg)";
  const inputBorder = "var(--input-border)";

  const cardBg = "var(--card-bg, rgba(255,255,255,0.92))";
  const border = "var(--border, rgba(0,0,0,0.12))";
  const shadowLg = "var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.20))";
  const shadowSm = "var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.06))";
  const rowBg = "var(--row-bg, rgba(0,0,0,0.04))";

  const card: CSSProperties = {
    borderRadius: 18,
    border: `1px solid ${border}`,
    background: cardBg,
    padding: 20,
    boxShadow: shadowLg,
    color: fg,
  };

  const miniBtn: CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: inputBg,
    color: fg,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    boxShadow: "var(--shadow-mini, 0 4px 14px rgba(0,0,0,0.06))",
    whiteSpace: "nowrap",
  };

  const ghostBtn: CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: inputBg,
    color: fg,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 13,
    boxShadow: shadowSm,
    whiteSpace: "nowrap",
  };

  const goAreaDetail = (areaId: string) => {
    router.push(`/areas/${areaId}?tab=dashboard&period=THIS_YEAR&template=ALL`);
  };

  const goWorstAuditDetail = (areaId: string, templateId: string) => {
    router.push(`/areas/${areaId}?tab=dashboard&period=THIS_MONTH&template=${templateId}`);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = (await requireRoleOrRedirect(router, ["admin", "manager", "auditor", "superadmin"], "/login")) as
          | Profile
          | null;

        if (!alive || !p) return;
        setProfile(p);

        if (p.role === "superadmin") {
          const stored = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
          setSelectedHotelId(stored || null);

          const { data: hData, error: hErr } = await supabase
            .from("hotels")
            .select("id,name,created_at")
            .order("created_at", { ascending: false });

          if (hErr) throw hErr;

          if (!alive) return;
          setHotels((hData ?? []) as HotelRow[]);
          setLoading(false);
          return;
        }

        if (!p.hotel_id) {
          setError("Tu usuario no tiene hotel asignado.");
          setLoading(false);
          return;
        }

        setSelectedHotelId(p.hotel_id);
        if (typeof window !== "undefined") localStorage.setItem(HOTEL_KEY, p.hotel_id);

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar el dashboard.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile) return;
      if (profile.role === "superadmin" && !selectedHotelId) return;
      if (!selectedHotelId) return;

      setLoading(true);
      setError(null);

      try {
        const hotelIdToUse = selectedHotelId;
        const isAdminLike = profile.role === "admin" || profile.role === "manager" || profile.role === "superadmin";

        let areasList: AreaRow[] = [];

        if (isAdminLike) {
          // ✅ ESTE ES EL ORDEN DEL DASHBOARD
          const { data, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id,sort_order")
            .eq("hotel_id", hotelIdToUse)
            .order("sort_order", { ascending: true, nullsFirst: false })
            .order("name", { ascending: true });

          if (aErr) throw aErr;
          areasList = (data ?? []) as AreaRow[];
        } else {
          const { data: accessData, error: accessErr } = await supabase
            .from("user_area_access")
            .select("area_id")
            .eq("user_id", profile.id)
            .eq("hotel_id", hotelIdToUse);

          if (accessErr) throw accessErr;

          const allowedIds = (accessData ?? []).map((r: any) => r.area_id).filter(Boolean);

          if (allowedIds.length > 0) {
            const { data: areasData, error: areasErr } = await supabase
              .from("areas")
              .select("id,name,type,hotel_id,sort_order")
              .eq("hotel_id", hotelIdToUse)
              .in("id", allowedIds)
              .order("sort_order", { ascending: true, nullsFirst: false })
              .order("name", { ascending: true });

            if (areasErr) throw areasErr;
            areasList = (areasData ?? []) as AreaRow[];
          }
        }

        if (!alive) return;
        setAreas(areasList);

        const areaIds = areasList.map((a) => a.id);
        if (areaIds.length === 0) {
          setRuns([]);
          setMonthScore({ avg: null, count: 0 });
          setQuarterScore({ avg: null, count: 0 });
          setYearScore({ avg: null, count: 0 });
          setHeatMapData([]);
          setTop3Areas([]);
          setWorst3Areas([]);
          setWorst3Audits([]);
          setLoading(false);
          return;
        }

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const { data: runsData, error: runsErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,executed_at,area_id,audit_template_id")
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

        const heatData: any[] = [];
        for (const area of areasList) {
          const areaRuns = runsList.filter((r) => r.area_id === area.id);
          const months: any[] = [];

          for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const y = d.getFullYear();
            const m = d.getMonth();

            const s = getMonthScore(areaRuns, y, m);
            months.push({ value: s.avg, count: s.count });
          }

          
          heatData.push({
  group: area.type ?? "Sin categoría",
  label: area.name,
  sort_order: area.sort_order ?? null,
  months,
});
        }
        setHeatMapData(heatData);

        const areaScores: AreaScore[] = areasList.map((area) => {
          const areaRuns = runsList.filter((r) => r.area_id === area.id);
          const s = getYearScore(areaRuns, currentYear);
          return { id: area.id, name: area.name, score: s.avg ?? 0, count: s.count };
        });

        const withData = areaScores.filter((a) => a.count > 0);

        setTop3Areas([...withData].sort((a, b) => b.score - a.score).slice(0, 3));
        setWorst3Areas([...withData].sort((a, b) => a.score - b.score).slice(0, 3));

        const templateIds = Array.from(new Set(runsList.map((r) => r.audit_template_id).filter(Boolean)));

        const templateNameById = new Map<string, string>();
        if (templateIds.length > 0) {
          const { data: templatesData, error: tErr } = await supabase.from("audit_templates").select("id,name").in("id", templateIds);
          if (tErr) throw tErr;
          (templatesData ?? []).forEach((t: any) => templateNameById.set(t.id, t.name));
        }

        const templateAgg = new Map<string, { sum: number; count: number }>();

        for (const r of runsList) {
          const score = Number(r.score);
          if (!Number.isFinite(score) || score < 0 || score > 100) continue;

          const key = r.audit_template_id;
          const prev = templateAgg.get(key) ?? { sum: 0, count: 0 };
          templateAgg.set(key, { sum: prev.sum + score, count: prev.count + 1 });
        }

        const templateAreaById = new Map<string, string>();
        for (const r of runsList) {
          if (r.audit_template_id && r.area_id && !templateAreaById.has(r.audit_template_id)) {
            templateAreaById.set(r.audit_template_id, r.area_id);
          }
        }

        const worstAudits: WorstAudit[] = Array.from(templateAgg.entries())
          .map(([id, v]) => ({
            id,
            areaId: templateAreaById.get(id) ?? "",
            name: templateNameById.get(id) ?? "Auditoría",
            avg: v.count > 0 ? v.sum / v.count : 0,
            count: v.count,
          }))
          .filter((a) => a.count > 0)
          .filter((a) => !!a.areaId)
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 3);

        setWorst3Audits(worstAudits);

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar el dashboard.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile, selectedHotelId]);

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
      const s = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
      labels.push(s.charAt(0).toUpperCase() + s.slice(1, 3));
    }
    return labels;
  }, []);

  const renderAreaRow = (area: AreaScore, idx: number, kind: "best" | "worst") => {
    const badge = kind === "best" ? (idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉") : "⚠️";
    const color = scoreColor(area.score);
    const trend = build3MonthTrend(area.id);

    return (
      <div key={area.id} className="rowCard" style={{ background: rowBg, border: `1px solid ${border}`, color: fg }}>
        <div className="rowLeft">
          <span className="rowBadge">{badge}</span>

          <div style={{ minWidth: 0 }}>
            <div className="rowTitle">{area.name}</div>

            <div className="rowTrend">
              <span className="rowTrendLabel">Tendencia 3 meses:</span>
              <div className="rowTrendItems">
                {trend.map((t) => (
                  <span key={`${t.key}-${t.year}-${t.monthIndex}`} className="rowTrendItem">
                    <strong>{t.key}</strong>{" "}
                    <span
                      style={{
                        color: t.avg === null ? "var(--placeholder)" : scoreColor(t.avg ?? 0),
                        fontWeight: 950,
                      }}
                    >
                      {t.avg === null ? "—" : `${(t.avg ?? 0).toFixed(1)}%`}
                    </span>{" "}
                    <span style={{ opacity: 0.65 }}>({t.count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rowRight">
          <span className="rowMeta">({area.count} auditorías)</span>
          <span className="rowScore" style={{ color }}>
            {area.score.toFixed(1)}%
          </span>
          <button onClick={() => goAreaDetail(area.id)} style={miniBtn} className="rowBtn">
            Ver detalle
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <main className="dash" style={{ background: bg, color: fg }}>
        <div style={{ opacity: 0.8 }}>Cargando…</div>
        <style jsx>{dashCss}</style>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dash" style={{ background: bg, color: fg }}>
        <div style={{ color: "var(--danger, crimson)", fontWeight: 900 }}>{error}</div>
        <style jsx>{dashCss}</style>
      </main>
    );
  }

  if (profile?.role === "superadmin" && !selectedHotelId) {
    return (
      <main className="dash" style={{ background: bg, color: fg }}>
        <div style={{ ...card, margin: "0 auto" }}>
          <div style={{ fontSize: 22, fontWeight: 950 }}>Elige un hotel</div>
          <div style={{ marginTop: 8, opacity: 0.7 }}>Como superadmin, primero selecciona el hotel con el que quieres trabajar.</div>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {hotels.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No hay hoteles creados todavía.</div>
            ) : (
              hotels.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    localStorage.setItem(HOTEL_KEY, h.id);
                    setSelectedHotelId(h.id);
                  }}
                  style={{
                    ...ghostBtn,
                    textAlign: "left",
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 950 }}>{h.name}</div>
                  <div style={{ opacity: 0.7, fontWeight: 900 }}>Entrar →</div>
                </button>
              ))
            )}
          </div>
        </div>

        <style jsx>{dashCss}</style>
      </main>
    );
  }

  const now = new Date();
  const monthName = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const selectedHotelName = hotels.find((h) => h.id === selectedHotelId)?.name ?? "Hotel";

  return (
    <main className="dash" style={{ background: bg, color: fg }}>
      <div className="topBar">
        <div className="topText">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ""}. Rol: <strong>{profile?.role}</strong> · Departamentos:{" "}
          <strong>{areas.length}</strong> · Hotel seleccionado: <strong>{selectedHotelName}</strong>
        </div>

        {profile?.role === "superadmin" ? (
          <button
            style={ghostBtn}
            onClick={() => {
              localStorage.removeItem(HOTEL_KEY);
              setSelectedHotelId(null);
              setAreas([]);
              setRuns([]);
              setHeatMapData([]);
              setTop3Areas([]);
              setWorst3Areas([]);
              setWorst3Audits([]);
            }}
          >
            Cambiar hotel
          </button>
        ) : null}
      </div>

      <div className="gridGauges">
        <div style={card} className="card">
          <GaugeChart value={monthScore.avg ?? 0} label={monthName.charAt(0).toUpperCase() + monthName.slice(1)} count={monthScore.count} size={180} />
        </div>

        <div style={card} className="card">
          <GaugeChart value={quarterScore.avg ?? 0} label={`Q${getCurrentQuarter()} ${now.getFullYear()}`} count={quarterScore.count} size={180} />
        </div>

        <div style={card} className="card">
          <GaugeChart value={yearScore.avg ?? 0} label={`Año ${now.getFullYear()}`} count={yearScore.count} size={180} />
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }} className="card">
        <div className="sectionTitle">Performance por departamento (últimos 12 meses)</div>
        {heatMapData.length > 0 ? <HeatMap data={heatMapData} monthLabels={monthLabels} /> : <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>}
      </div>

      {(top3Areas.length > 0 || worst3Areas.length > 0) && (
        <div className="gridTwo" style={{ marginTop: 16 }}>
          <div style={card} className="card">
            <div className="sectionTitle">Top 3 departamentos con mejor performance ({now.getFullYear()})</div>
            <div style={{ display: "grid", gap: 12 }}>
              {top3Areas.length > 0 ? top3Areas.map((a, idx) => renderAreaRow(a, idx, "best")) : <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>}
            </div>
          </div>

          <div style={card} className="card">
            <div className="sectionTitle">Top 3 departamentos con peor performance ({now.getFullYear()})</div>
            <div style={{ display: "grid", gap: 12 }}>
              {worst3Areas.length > 0 ? worst3Areas.map((a, idx) => renderAreaRow(a, idx, "worst")) : <div style={{ opacity: 0.7 }}>No hay datos suficientes.</div>}
            </div>
          </div>
        </div>
      )}

      {worst3Audits.length > 0 && (
        <div style={{ ...card, marginTop: 16 }} className="card">
          <div className="sectionTitle">Top 3 auditorías con peor resultado (promedio)</div>

          <div style={{ display: "grid", gap: 12 }}>
            {worst3Audits.map((a, idx) => (
              <div key={a.id} className="rowCard" style={{ background: rowBg, border: `1px solid ${border}`, color: fg }}>
                <div className="rowLeft">
                  <span className="rowBadge">{idx === 0 ? "🚨" : "⚠️"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="rowTitle">{a.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                      {a.count} ejecución{a.count === 1 ? "" : "es"} · promedio del periodo
                    </div>
                  </div>
                </div>

                <div className="rowRight">
                  <span className="rowScore" style={{ color: scoreColor(a.avg) }}>
                    {a.avg.toFixed(1)}%
                  </span>
                  <button onClick={() => goWorstAuditDetail(a.areaId, a.id)} style={miniBtn} className="rowBtn">
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acceso rápido (sin Builder) */}
      <div className="gridQuick" style={{ marginTop: 16 }}>
        <button
          onClick={() => router.push("/areas")}
          className="quickBtn"
          style={{
            textAlign: "left",
            padding: 16,
            borderRadius: 14,
            border: `1px solid ${inputBorder}`,
            background: inputBg,
            color: fg,
            boxShadow: shadowSm,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900 }}>Ver todos los departamentos</div>
          <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>Explorar auditorías por departamento</div>
        </button>
      </div>

      <style jsx>{dashCss}</style>
    </main>
  );
}

const dashCss = `
  .dash{ padding: 24px; }

  .topBar{
    display:flex; justify-content:space-between; align-items:center;
    gap:12px; margin-bottom:18px;
  }

  .topText{ opacity:0.7; font-size:14px; line-height:1.25; }

  .sectionTitle{ font-size:18px; font-weight:950; margin-bottom:16px; }

  .gridGauges{
    display:grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap:16px;
  }

  .gridTwo{
    display:grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap:16px;
  }

  .gridQuick{
    display:grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap:14px;
  }

  .rowCard{
    display:flex; justify-content:space-between; align-items:center;
    padding:14px 16px; border-radius:12px; gap:12px;
  }

  .rowLeft{ display:flex; align-items:flex-start; gap:12px; min-width:0; flex:1; }
  .rowBadge{ font-size:22px; line-height:22px; flex-shrink:0; }
  .rowTitle{ font-weight:950; font-size:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  .rowTrend{ margin-top:6px; display:flex; flex-wrap:wrap; gap:10px; opacity:0.85; }
  .rowTrendLabel{ font-size:12px; font-weight:900; }
  .rowTrendItems{ display:flex; gap:10px; flex-wrap:wrap; }
  .rowTrendItem{ font-size:12px; }

  .rowRight{ display:flex; align-items:center; gap:12px; flex-shrink:0; }
  .rowMeta{ font-size:13px; opacity:0.7; white-space:nowrap; }
  .rowScore{ font-weight:950; font-size:20px; white-space:nowrap; }

  @media (max-width: 720px){
    .dash{ padding:14px 12px; }
    .card{ padding:16px !important; border-radius:22px !important; }
    .topBar{ flex-direction:column; align-items:stretch; margin-bottom:14px; }
    .sectionTitle{ font-size:20px; margin-bottom:12px; line-height:1.1; }
    .gridGauges{ grid-template-columns:1fr; gap:12px; }
    .gridTwo{ grid-template-columns:1fr; gap:12px; }
    .gridQuick{ grid-template-columns:1fr; gap:12px; }
    .rowCard{ flex-direction:column; align-items:stretch; gap:10px; }
    .rowRight{ justify-content:space-between; }
    .rowBtn{ width:100%; }
  }
`;