"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole, type Role } from "@/lib/auth/permissions";
import { canRunAudits } from "@/lib/auth/permissions";
import BackButton from "@/app/components/BackButton";

// ----------------------
// Types
// ----------------------
type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};

type Area = {
  id: string;
  name: string;
  type: string | null;
  hotel_id?: string | null;
};

type AuditTemplate = {
  id: string;
  name: string;
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

type SectionTotal = {
  section_id: string;
  section_name: string;
  total_questions: number;
};

type AnswerRow = {
  audit_run_id: string;
  question_id: string;
  result: string | null;
};

type QuestionMeta = {
  id: string;
  text: string;
  audit_section_id: string;
  section_name: string;
};

type PeriodKey = "THIS_MONTH" | "LAST_3_MONTHS" | "THIS_YEAR";

const HOTEL_KEY = "sc_hotel_id";

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
  if (score < 60) return "#c62828";
  if (score < 80) return "#ef6c00";
  return "#000";
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function monthLabel(monthIndex: number) {
  const d = new Date(2020, monthIndex, 1);
  const s = d.toLocaleDateString("es-ES", { month: "long" }).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthStartEndISO(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getPeriodRange(now: Date, p: PeriodKey) {
  const end = new Date(now);
  let start: Date;

  if (p === "THIS_MONTH") start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  else if (p === "LAST_3_MONTHS") start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
  else start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

  return { startMs: start.getTime(), endMs: end.getTime() };
}

export default function AreaPage() {
  const router = useRouter();
  const params = useParams<{ areaId: string }>();
  const searchParams = useSearchParams();

  const areaId = params?.areaId;

  // ✅ default dashboard
  const tab = (searchParams.get("tab") ?? "dashboard") as "dashboard" | "history" | "templates";

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [area, setArea] = useState<Area | null>(null);

  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Record<string, string>>({});
  const [executorNameById, setExecutorNameById] = useState<Record<string, string>>({});
  const [totalsByTemplate, setTotalsByTemplate] = useState<Record<string, Record<string, SectionTotal>>>({});
  const [exceptionsByRun, setExceptionsByRun] = useState<Record<string, Record<string, { fail: number; na: number }>>>({});
  const [answersByRun, setAnswersByRun] = useState<Record<string, AnswerRow[]>>({});
  const [questionMetaById, setQuestionMetaById] = useState<Record<string, QuestionMeta>>({});

  const [templateFilter, setTemplateFilter] = useState<string>("ALL");
  const [period, setPeriod] = useState<PeriodKey>("THIS_MONTH");

  const now = new Date();
  const [histTemplateId, setHistTemplateId] = useState<string>("");
  const [histYear, setHistYear] = useState<number>(now.getFullYear());
  const [histMonth, setHistMonth] = useState<number>(now.getMonth());
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  const [histRuns, setHistRuns] = useState<AuditRunRow[]>([]);

  // ✅ si entran sin tab => dashboard
  useEffect(() => {
    if (!areaId) return;
    if (!searchParams.get("tab")) router.replace(`/areas/${areaId}?tab=dashboard`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  // ✅ AUTH + LOAD (SIN RequireRole)
  useEffect(() => {
    if (!areaId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr || !auth?.user) {
          router.replace("/login");
          return;
        }

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, hotel_id, active")
          .eq("id", auth.user.id)
          .maybeSingle();

        if (profErr || !prof || prof.active === false) {
          router.replace("/login");
          return;
        }

        const p: Profile = {
          id: prof.id,
          full_name: prof.full_name ?? null,
          role: normalizeRole(prof.role),
          hotel_id: prof.hotel_id ?? null,
          active: prof.active ?? null,
        };

        // ✅ roles permitidos
        if (!["admin", "manager", "auditor", "superadmin"].includes(p.role)) {
          router.replace("/login");
          return;
        }

        // ✅ permiso de acceder al módulo
        const allowed = p.role === "superadmin" ? true : canRunAudits(p.role);
        if (!allowed) {
          setError("No tienes permisos para acceder a esta sección.");
          setLoading(false);
          return;
        }

        setProfile(p);

        // 1) Área
        const { data: areaData, error: areaErr } = await supabase
          .from("areas")
          .select("id,name,type,hotel_id")
          .eq("id", areaId)
          .single();

        if (areaErr || !areaData) throw areaErr ?? new Error("Área no encontrada");
        setArea(areaData as Area);

        // 2) Templates del área
        const { data: tData, error: tErr } = await supabase
          .from("audit_templates")
          .select("id,name,active,area_id")
          .eq("area_id", areaId)
          .order("name", { ascending: true });

        if (tErr) throw tErr;

        const onlyActive = (tData ?? []).filter((t: any) => t.active !== false) as AuditTemplate[];
        setTemplates(onlyActive);
        if (!histTemplateId && onlyActive.length > 0) setHistTemplateId(onlyActive[0].id);

        // 3) Runs
        const { data: runData, error: runErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
          .eq("area_id", areaId)
          .order("executed_at", { ascending: false })
          .limit(80);

        if (runErr) throw runErr;

        const allRuns = (runData ?? []) as AuditRunRow[];
        const submitted = allRuns.filter((r) => (r.status ?? "").toLowerCase() === "submitted");
        const finalRuns = submitted.length ? submitted : allRuns;
        setRuns(finalRuns);

        const runIds = Array.from(new Set(finalRuns.map((r) => r.id)));
        const templateIds = Array.from(new Set(finalRuns.map((r) => r.audit_template_id)));
        const executorIds = Array.from(new Set(finalRuns.map((r) => r.executed_by).filter(Boolean) as string[]));

        // 4) nombres templates
        if (templateIds.length) {
          const { data: tplData, error: tplErr } = await supabase.from("audit_templates").select("id,name").in("id", templateIds);
          if (tplErr) throw tplErr;
          const map: Record<string, string> = {};
          for (const row of (tplData ?? []) as any[]) map[row.id] = row.name;
          setTemplateNameById(map);
        }

        // 5) nombres ejecutores
        if (executorIds.length) {
          const { data: pData, error: pErr } = await supabase.from("profiles").select("id,full_name").in("id", executorIds);
          if (!pErr && pData) {
            const map: Record<string, string> = {};
            for (const row of pData as any[]) map[row.id] = row.full_name ?? row.id;
            setExecutorNameById(map);
          }
        }

        // 6) totales sección
        if (templateIds.length) {
          const { data: qData, error: qErr } = await supabase
            .from("audit_questions")
            .select(
              `
              id,
              active,
              audit_section_id,
              audit_sections!inner (
                id,
                name,
                audit_template_id
              )
            `
            )
            .in("audit_sections.audit_template_id", templateIds)
            .eq("active", true);

          if (qErr) throw qErr;

          const totals: Record<string, Record<string, SectionTotal>> = {};
          for (const row of (qData ?? []) as any[]) {
            const tplId = row.audit_sections?.audit_template_id as string | undefined;
            const secId = (row.audit_sections?.id ?? row.audit_section_id) as string | undefined;
            const secName = (row.audit_sections?.name ?? "Sin sección") as string;
            if (!tplId || !secId) continue;
            if (!totals[tplId]) totals[tplId] = {};
            if (!totals[tplId][secId]) totals[tplId][secId] = { section_id: secId, section_name: secName, total_questions: 0 };
            totals[tplId][secId].total_questions += 1;
          }
          setTotalsByTemplate(totals);
        }

        // 7) answers
        if (runIds.length) {
          const { data: aData, error: aErr } = await supabase
            .from("audit_answers")
            .select("audit_run_id,question_id,result")
            .in("audit_run_id", runIds);

          if (aErr) throw aErr;

          const answers = (aData ?? []) as AnswerRow[];
          const byRun: Record<string, AnswerRow[]> = {};
          for (const a of answers) {
            if (!byRun[a.audit_run_id]) byRun[a.audit_run_id] = [];
            byRun[a.audit_run_id].push(a);
          }
          setAnswersByRun(byRun);

          const questionIds = Array.from(new Set(answers.map((a) => a.question_id)));

          const qMetaMap: Record<string, QuestionMeta> = {};
          if (questionIds.length) {
            const { data: q2Data, error: q2Err } = await supabase
              .from("audit_questions")
              .select(
                `
                id,
                text,
                audit_section_id,
                audit_sections (
                  id,
                  name
                )
              `
              )
              .in("id", questionIds);

            if (q2Err) throw q2Err;

            for (const q of (q2Data ?? []) as any[]) {
              const secId = (q.audit_sections?.id ?? q.audit_section_id ?? "unknown") as string;
              const secName = (q.audit_sections?.name ?? "Sin sección") as string;
              qMetaMap[q.id] = { id: q.id, text: q.text ?? "(Sin texto)", audit_section_id: secId, section_name: secName };
            }
          }
          setQuestionMetaById(qMetaMap);

          const ex: Record<string, Record<string, { fail: number; na: number }>> = {};
          for (const row of answers) {
            const rid = row.audit_run_id;
            const res = String(row.result ?? "").toUpperCase();
            const secId = qMetaMap[row.question_id]?.audit_section_id ?? "unknown";
            if (!ex[rid]) ex[rid] = {};
            if (!ex[rid][secId]) ex[rid][secId] = { fail: 0, na: 0 };
            if (res === "FAIL") ex[rid][secId].fail += 1;
            if (res === "NA") ex[rid][secId].na += 1;
          }
          setExceptionsByRun(ex);
        }

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando área.");
      }
    })();
  }, [areaId, router, histTemplateId]);

  async function handleStart(templateId: string) {
    if (!profile || !areaId) return;

    setStarting(templateId);
    setError(null);

    try {
      const { data: auth, error: userErr } = await supabase.auth.getUser();
      if (userErr || !auth?.user) throw userErr ?? new Error("No hay sesión activa.");

      const hotelIdFromLocalStorage = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
      const hotelIdToUse = area?.hotel_id ?? profile?.hotel_id ?? hotelIdFromLocalStorage;
      if (!hotelIdToUse) throw new Error("No se pudo determinar el hotel_id para crear la auditoría.");

      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("audit_runs")
        .insert({
          hotel_id: hotelIdToUse,
          area_id: areaId,
          audit_template_id: templateId,
          status: "draft",
          score: null,
          notes: null,
          executed_at: nowIso,
          executed_by: auth.user.id,
        })
        .select("id")
        .single();

      if (error || !data) throw error ?? new Error("No se pudo crear la auditoría.");
      router.push(`/audits/${data.id}`);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar la auditoría.");
    } finally {
      setStarting(null);
    }
  }

  async function handleSearchHistory() {
    if (!areaId || !histTemplateId) return;

    setHistLoading(true);
    setHistError(null);

    try {
      const { start, end } = monthStartEndISO(histYear, histMonth);

      const { data, error: rErr } = await supabase
        .from("audit_runs")
        .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
        .eq("area_id", areaId)
        .eq("status", "submitted")
        .eq("audit_template_id", histTemplateId)
        .gte("executed_at", start)
        .lt("executed_at", end)
        .order("executed_at", { ascending: false });

      if (rErr) throw rErr;
      setHistRuns((data ?? []) as AuditRunRow[]);
    } catch (e: any) {
      setHistError(e?.message ?? "No se pudo buscar el historial.");
      setHistRuns([]);
    } finally {
      setHistLoading(false);
    }
  }

  const dashboard = useMemo(() => {
    const WINDOW = 4;
    const { startMs, endMs } = getPeriodRange(new Date(), period);

    const base = runs
      .filter((r) => (r.status ?? "").toLowerCase() === "submitted")
      .filter((r) => typeof r.score === "number" && r.executed_at)
      .filter((r) => (templateFilter === "ALL" ? true : r.audit_template_id === templateFilter))
      .filter((r) => {
        const t = r.executed_at ? new Date(r.executed_at).getTime() : 0;
        return t >= startMs && t <= endMs;
      });

    const sorted = [...base].sort((a, b) => {
      const ta = a.executed_at ? new Date(a.executed_at).getTime() : 0;
      const tb = b.executed_at ? new Date(b.executed_at).getTime() : 0;
      return tb - ta;
    });

    const lastN = sorted.slice(0, WINDOW);
    const lastRun = sorted[0] ?? null;

    const avgScore =
      lastN.length === 0
        ? null
        : Math.round((lastN.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / lastN.length) * 100) / 100;

    return { lastRun, avgScore, windowSize: lastN.length };
  }, [runs, period, templateFilter]);

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: active ? "#000" : "#fff",
    color: active ? "#fff" : "#000",
    fontWeight: 900,
    cursor: "pointer",
  });

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.20)",
    background: "#fff",
    fontWeight: 900,
  };

  const primaryBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const ghostBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const HeaderRow = ({ size }: { size: number }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
      <h1 style={{ fontSize: size, margin: 0 }}>{area?.name ?? "Área"}</h1>
      <BackButton fallback="/areas" />
    </div>
  );

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <HeaderRow size={44} />
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <HeaderRow size={52} />
        <p style={{ color: "crimson", fontWeight: 800 }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <HeaderRow size={56} />

      <div style={{ opacity: 0.85, marginBottom: 18 }}>
        {area?.type ? `${area.type} · ` : ""}
        Rol: <strong>{profile?.role}</strong>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button style={tabBtn(tab === "dashboard")} onClick={() => router.replace(`/areas/${areaId}?tab=dashboard`)}>
          Dashboard
        </button>
        <button style={tabBtn(tab === "history")} onClick={() => router.replace(`/areas/${areaId}?tab=history`)}>
          Historial
        </button>
        <button style={tabBtn(tab === "templates")} onClick={() => router.replace(`/areas/${areaId}?tab=templates`)}>
          Auditorías disponibles
        </button>
      </div>

      {tab === "dashboard" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Dashboard por área</div>
            <div style={{ opacity: 0.85 }}>
              Score promedio (últimas {dashboard.windowSize || 0}):{" "}
              <strong style={{ color: scoreColor(dashboard.avgScore) }}>
                {dashboard.avgScore === null ? "—" : `${dashboard.avgScore.toFixed(2)}%`}
              </strong>
            </div>
            {dashboard.lastRun ? (
              <button style={{ marginTop: 12, ...primaryBtn }} onClick={() => router.push(`/audits/${dashboard.lastRun!.id}`)}>
                Ver última auditoría
              </button>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.75 }}>No hay auditorías enviadas todavía.</div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 12 }}>Historial</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>Tipo de auditoría</div>
                <select value={histTemplateId} onChange={(e) => setHistTemplateId(e.target.value)} style={inputStyle}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  {templates.length === 0 ? <option value="">No hay auditorías</option> : null}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>Año</div>
                <select value={histYear} onChange={(e) => setHistYear(Number(e.target.value))} style={inputStyle}>
                  {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.75, marginBottom: 6 }}>Mes</div>
                <select value={histMonth} onChange={(e) => setHistMonth(Number(e.target.value))} style={inputStyle}>
                  {Array.from({ length: 12 }, (_, m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={handleSearchHistory} style={primaryBtn} disabled={!histTemplateId || histLoading}>
                  {histLoading ? "Buscando…" : "Buscar"}
                </button>
                <button
                  onClick={() => {
                    setHistRuns([]);
                    setHistError(null);
                  }}
                  style={ghostBtn}
                  disabled={histLoading}
                >
                  Limpiar
                </button>
              </div>
            </div>

            {histError ? <div style={{ marginTop: 12, color: "crimson", fontWeight: 900 }}>{histError}</div> : null}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Resultados</div>

            {histRuns.length === 0 ? (
              <div style={{ opacity: 0.8 }}>
                No hay auditorías para ese periodo. Selecciona filtros y pulsa <strong>Buscar</strong>.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {histRuns.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid rgba(0,0,0,0.10)",
                      borderRadius: 14,
                      padding: 14,
                      background: "rgba(0,0,0,0.02)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 260 }}>
                      <div style={{ fontWeight: 950 }}>{fmtDate(r.executed_at)}</div>
                      <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                        Score:{" "}
                        <span style={{ fontWeight: 950, color: scoreColor(r.score) }}>
                          {r.score === null ? "—" : `${Number(r.score).toFixed(2)}%`}
                        </span>
                      </div>
                    </div>

                    <button onClick={() => router.push(`/audits/${r.id}`)} style={primaryBtn}>
                      Ver auditoría
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "templates" ? (
        <>
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>Auditorías disponibles</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {templates.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "#fff",
                  color: "#000",
                  borderRadius: 18,
                  padding: 18,
                  minHeight: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 16 }}>{t.name}</div>

                <button
                  onClick={() => handleStart(t.id)}
                  disabled={starting === t.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.2)",
                    background: "#000",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: starting === t.id ? "not-allowed" : "pointer",
                    opacity: starting === t.id ? 0.7 : 1,
                  }}
                >
                  {starting === t.id ? "Iniciando…" : "Iniciar"}
                </button>
              </div>
            ))}
          </div>

          {templates.length === 0 ? <p style={{ marginTop: 16, opacity: 0.85 }}>No hay auditorías asignadas a esta área todavía.</p> : null}
        </>
      ) : null}
    </main>
  );
}