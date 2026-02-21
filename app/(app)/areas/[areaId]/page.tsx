"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canRunAudits } from "@/lib/auth/permissions";
import BackButton from "@/app/components/BackButton";

// ----------------------
// Types
// ----------------------
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

type SectionAgg = {
  section_id: string;
  section_name: string;
  total_questions: number;
  fail_count: number;
  na_count: number;
  denom: number; // total - NA
  pass: number; // denom - FAIL
  score: number | null;
};

type RunAgg = {
  run: AuditRunRow;
  templateName: string;
  executedByName: string | null;
  sections: SectionAgg[];
};

type AnswerRow = {
  audit_run_id: string;
  question_id: string;
  result: string | null; // PASS/FAIL/NA...
};

type QuestionMeta = {
  id: string;
  text: string;
  audit_section_id: string;
  section_name: string;
};

type PeriodKey = "THIS_MONTH" | "LAST_3_MONTHS" | "THIS_YEAR";

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
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="tendencia" style={{ display: "block" }}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}

function monthLabel(monthIndex: number) {
  const d = new Date(2020, monthIndex, 1);
  const s = d.toLocaleDateString("es-ES", { month: "long" }).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthStartEndISO(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0); // exclusive
  return { start: start.toISOString(), end: end.toISOString() };
}

function periodLabel(p: PeriodKey) {
  if (p === "THIS_MONTH") return "Este mes";
  if (p === "LAST_3_MONTHS") return "3 últimos meses";
  return "Año";
}

function getPeriodRange(now: Date, p: PeriodKey) {
  // end = ahora (incluido)
  const end = new Date(now);

  let start: Date;
  if (p === "THIS_MONTH") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (p === "LAST_3_MONTHS") {
    // Incluye el mes actual + 2 anteriores (3 meses naturales)
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
  } else {
    // Año en curso
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  }

  return { startMs: start.getTime(), endMs: end.getTime() };
}

export default function AreaPage() {
  const router = useRouter();
  const params = useParams<{ areaId: string }>();
  const searchParams = useSearchParams();

  // ✅ DEFAULT: dashboard
  const tab = (searchParams.get("tab") ?? "dashboard") as "history" | "templates" | "dashboard";
  const areaId = params?.areaId;

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [area, setArea] = useState<Area | null>(null);

  // Templates
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);

  // History / Data (para tu histórico general actual)
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Record<string, string>>({});
  const [executorNameById, setExecutorNameById] = useState<Record<string, string>>({});
  const [totalsByTemplate, setTotalsByTemplate] = useState<Record<string, Record<string, SectionTotal>>>({});
  const [exceptionsByRun, setExceptionsByRun] = useState<Record<string, Record<string, { fail: number; na: number }>>>({});

  // ✅ NUEVO: answers por run (para ranking de estándares)
  const [answersByRun, setAnswersByRun] = useState<Record<string, AnswerRow[]>>({});
  // ✅ NUEVO: meta de preguntas (id -> text/section)
  const [questionMetaById, setQuestionMetaById] = useState<Record<string, QuestionMeta>>({});

  // ✅ filtro de dashboard por plantilla
  const [templateFilter, setTemplateFilter] = useState<string>("ALL");

  // ✅ NUEVO: filtro de periodo del dashboard
  const [period, setPeriod] = useState<PeriodKey>("THIS_MONTH");

  // ✅ Historial (nuevo) con filtros en cascada
  const now = new Date();
  const [histTemplateId, setHistTemplateId] = useState<string>("");
  const [histYear, setHistYear] = useState<number>(now.getFullYear());
  const [histMonth, setHistMonth] = useState<number>(now.getMonth());

  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  const [histRuns, setHistRuns] = useState<AuditRunRow[]>([]);

  // ✅ Si entran sin tab, forzar dashboard
  useEffect(() => {
    if (!areaId) return;
    const t = searchParams.get("tab");
    if (!t) {
      router.replace(`/areas/${areaId}?tab=dashboard`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  // ----------------------
  // Load all data (como tenías)
  // ----------------------
  useEffect(() => {
    if (!areaId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/areas");
        if (!p) return;
        setProfile(p);

        if (!canRunAudits(p.role)) {
          setError("No tienes permisos para acceder a esta sección.");
          setLoading(false);
          return;
        }

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

        // ✅ default del filtro de historial: el primero
        if (!histTemplateId && onlyActive.length > 0) {
          setHistTemplateId(onlyActive[0].id);
        }

        // 3) Runs (últimos 80) para dashboard / cálculos
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

        // 4) Nombres templates
        if (templateIds.length) {
          const { data: tplData, error: tplErr } = await supabase.from("audit_templates").select("id,name").in("id", templateIds);
          if (tplErr) throw tplErr;

          const map: Record<string, string> = {};
          for (const row of (tplData ?? []) as any[]) map[row.id] = row.name;
          setTemplateNameById(map);
        }

        // 5) Nombres ejecutores
        if (executorIds.length) {
          const { data: pData, error: pErr } = await supabase.from("profiles").select("id,full_name").in("id", executorIds);
          if (!pErr && pData) {
            const map: Record<string, string> = {};
            for (const row of pData as any[]) map[row.id] = row.full_name ?? row.id;
            setExecutorNameById(map);
          }
        }

        // 6) Totales por sección (por template)
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

        // 7) Answers (para FAIL/NA por sección + ranking de estándares)
        if (runIds.length) {
          const { data: aData, error: aErr } = await supabase
            .from("audit_answers")
            .select("audit_run_id,question_id,result")
            .in("audit_run_id", runIds);

          if (aErr) throw aErr;

          const answers = (aData ?? []) as AnswerRow[];

          // ✅ answersByRun
          const byRun: Record<string, AnswerRow[]> = {};
          for (const a of answers) {
            if (!byRun[a.audit_run_id]) byRun[a.audit_run_id] = [];
            byRun[a.audit_run_id].push(a);
          }
          setAnswersByRun(byRun);

          const questionIds = Array.from(new Set(answers.map((a) => a.question_id)));

          // ✅ traemos META completa de preguntas (incluye text + sección + nombre sección)
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
              qMetaMap[q.id] = {
                id: q.id,
                text: q.text ?? "(Sin texto)",
                audit_section_id: secId,
                section_name: secName,
              };
            }
          }
          setQuestionMetaById(qMetaMap);

          // ✅ Excepciones FAIL/NA por run y sección (como antes)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, router]);

  // ----------------------
  // Start run (igual)
  // ----------------------
  async function handleStart(templateId: string) {
    if (!profile || !areaId) return;

    setStarting(templateId);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw userErr ?? new Error("No hay sesión activa.");

      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("audit_runs")
        .insert({
          hotel_id: profile.hotel_id,
          area_id: areaId,
          audit_template_id: templateId,
          status: "draft",
          score: null,
          notes: null,
          executed_at: nowIso,
          executed_by: user.id,
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

  // ----------------------
  // ✅ Nuevo: buscar historial por (template + year + month)
  // ----------------------
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

  // ----------------------
  // History aggregation (lo dejas)
  // ----------------------
  const aggregatedHistory: RunAgg[] = useMemo(() => {
    return runs.map((r) => {
      const templateName = templateNameById[r.audit_template_id] ?? r.audit_template_id;
      const executedByName = r.executed_by ? executorNameById[r.executed_by] ?? r.executed_by : null;

      const totals = totalsByTemplate[r.audit_template_id] ?? {};
      const exceptions = exceptionsByRun[r.id] ?? {};
      const sectionIds = Object.keys(totals);

      const sections: SectionAgg[] = sectionIds.map((secId) => {
        const t = totals[secId];
        const fail = exceptions[secId]?.fail ?? 0;
        const na = exceptions[secId]?.na ?? 0;

        const totalQ = t?.total_questions ?? 0;
        const denom = Math.max(0, totalQ - na);
        const pass = Math.max(0, denom - fail);
        const score = denom === 0 ? null : (pass / denom) * 100;

        return {
          section_id: secId,
          section_name: t?.section_name ?? "Sin sección",
          total_questions: totalQ,
          fail_count: fail,
          na_count: na,
          denom,
          pass,
          score,
        };
      });

      sections.sort((a, b) => a.section_name.localeCompare(b.section_name));
      return { run: r, templateName, executedByName, sections };
    });
  }, [runs, templateNameById, executorNameById, totalsByTemplate, exceptionsByRun]);

  // ----------------------
  // Dashboard aggregation
  // ✅ MODIFICADO: filtro por periodo + ranking estándares + ranking secciones sin FAIL/NA
  // ----------------------
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

    // Tendencia (últimos 12 dentro del periodo)
    const trendRuns = [...sorted].slice(0, 12).reverse();
    const trendValues = trendRuns
      .map((r) => Number(r.score))
      .filter((n) => Number.isFinite(n))
      .map((n) => clamp(n, 0, 100));

    // ✅ Ranking de secciones AGRUPADO POR NOMBRE (análisis transversal)
    const sectionStats: Record<string, { name: string; scores: number[] }> = {};

    for (const run of lastN) {
      const totals = totalsByTemplate[run.audit_template_id] ?? {};
      const exceptions = exceptionsByRun[run.id] ?? {};

      for (const secId of Object.keys(totals)) {
        const t = totals[secId];
        const fail = exceptions[secId]?.fail ?? 0;
        const na = exceptions[secId]?.na ?? 0;

        const totalQ = t?.total_questions ?? 0;
        const denom = Math.max(0, totalQ - na);
        const pass = Math.max(0, denom - fail);
        const score = denom === 0 ? null : (pass / denom) * 100;

        const sectionName = t?.section_name ?? "Sin sección";
        if (!sectionStats[sectionName]) sectionStats[sectionName] = { name: sectionName, scores: [] };
        if (score !== null) sectionStats[sectionName].scores.push(score);
      }
    }

    const sectionRanking = Object.values(sectionStats)
      .map((s) => {
        const avg =
          s.scores.length === 0
            ? null
            : Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 100) / 100;
        return { section_name: s.name, avg_score: avg };
      })
      .sort((a, b) => {
        const av = a.avg_score ?? 9999;
        const bv = b.avg_score ?? 9999;
        return av - bv;
      });

    const worstSection = sectionRanking.find((x) => x.avg_score !== null) ?? null;
    const bestSection = [...sectionRanking].reverse().find((x) => x.avg_score !== null) ?? null;

    // ✅ Ranking de estándares (preguntas) - Top 10 peor puntuados
    const runsInWindow = lastN.map((r) => r.id);
    const denomRuns = Math.max(1, runsInWindow.length);

    const qStats: Record<
      string,
      {
        question_id: string;
        text: string;
        totalFail: number;
        totalNa: number;
        totalSeen: number; // total respuestas (incluye NA)
      }
    > = {};

    for (const runId of runsInWindow) {
      const arr = answersByRun[runId] ?? [];
      for (const a of arr) {
        const qid = a.question_id;
        const meta = questionMetaById[qid];
        const text = meta?.text ?? "(Sin texto)";

        if (!qStats[qid]) {
          qStats[qid] = { question_id: qid, text, totalFail: 0, totalNa: 0, totalSeen: 0 };
        }

        const res = String(a.result ?? "").toUpperCase();
        qStats[qid].totalSeen += 1;
        if (res === "FAIL") qStats[qid].totalFail += 1;
        if (res === "NA") qStats[qid].totalNa += 1;
      }
    }

    const standardsRanking = Object.values(qStats)
      .map((q) => {
        const denom = Math.max(0, q.totalSeen - q.totalNa);
        const pass = Math.max(0, denom - q.totalFail);
        const score = denom === 0 ? null : Math.round(((pass / denom) * 100) * 100) / 100;

        const avgFail = Math.round((q.totalFail / denomRuns) * 100) / 100;
        const avgNa = Math.round((q.totalNa / denomRuns) * 100) / 100;

        return {
          question_id: q.question_id,
          text: q.text,
          avg_score: score,
          avg_fail: avgFail,
          avg_na: avgNa,
        };
      })
      .sort((a, b) => {
        const av = a.avg_score ?? 9999;
        const bv = b.avg_score ?? 9999;
        return av - bv;
      })
      .slice(0, 10);

    const filterLabel =
      templateFilter === "ALL"
        ? "General (todas)"
        : templateNameById[templateFilter] ?? templates.find((t) => t.id === templateFilter)?.name ?? "Plantilla";

    return {
      lastRun,
      avgScore,
      trendValues,
      sectionRanking,
      worstSection,
      bestSection,
      standardsRanking,
      windowSize: lastN.length,
      filterLabel,
      periodLabel: periodLabel(period),
    };
  }, [
    runs,
    totalsByTemplate,
    exceptionsByRun,
    templateFilter,
    templateNameById,
    templates,
    period,
    answersByRun,
    questionMetaById,
  ]);

  // ----------------------
  // UI styles
  // ----------------------
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
    whiteSpace: "ությամբnowrap",
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

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <BackButton fallback="/areas" />
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>{area?.name ?? "Área"}</h1>
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <BackButton fallback="/areas" />
        <h1 style={{ fontSize: 52, marginBottom: 8 }}>{area?.name ?? "Área"}</h1>
        <p style={{ color: "crimson", fontWeight: 800 }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <BackButton fallback="/areas" />

      <h1 style={{ fontSize: 56, marginBottom: 6 }}>{area?.name ?? "Área"}</h1>

      <div style={{ opacity: 0.85, marginBottom: 18 }}>
        {area?.type ? `${area.type} · ` : ""}
        Rol: <strong>{profile?.role}</strong>
      </div>

      {/* ✅ Orden tabs: Dashboard primero */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button style={tabBtn(tab === "dashboard")} onClick={() => router.push(`/areas/${areaId}?tab=dashboard`)}>
          Dashboard
        </button>
        <button style={tabBtn(tab === "history")} onClick={() => router.push(`/areas/${areaId}?tab=history`)}>
          Historial
        </button>
        <button style={tabBtn(tab === "templates")} onClick={() => router.push(`/areas/${areaId}?tab=templates`)}>
          Auditorías disponibles
        </button>
      </div>

      {/* ---------------------- */}
      {/* DASHBOARD */}
      {/* ---------------------- */}
      {tab === "dashboard" ? (
        <div style={{ display: "grid", gap: 14 }}>
          {/* header dashboard + selectors */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 22, fontWeight: 950 }}>Dashboard por área</div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* ✅ Periodo */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 900, opacity: 0.9 }}>Periodo:</div>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "2px solid rgba(255,0,150,0.20)",
                    outline: "none",
                    minWidth: 220,
                    fontWeight: 900,
                    background: "#fff",
                  }}
                >
                  <option value="THIS_MONTH">Este mes</option>
                  <option value="LAST_3_MONTHS">3 últimos meses</option>
                  <option value="THIS_YEAR">Año</option>
                </select>
              </div>

              {/* Vista / template */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 900, opacity: 0.9 }}>Vista:</div>
                <select
                  value={templateFilter}
                  onChange={(e) => setTemplateFilter(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "2px solid rgba(255,0,150,0.35)",
                    outline: "none",
                    minWidth: 260,
                    fontWeight: 900,
                    background: "#fff",
                  }}
                >
                  <option value="ALL">General (todas)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>
                Score promedio (últimas {dashboard.windowSize || 0})
              </div>
              <div style={{ fontSize: 34, fontWeight: 950, color: scoreColor(dashboard.avgScore) }}>
                {dashboard.avgScore === null ? "—" : `${dashboard.avgScore.toFixed(2)}%`}
              </div>

              <div style={{ marginTop: 10, opacity: 0.85, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 900 }}>Tendencia</span>
                <span style={{ color: scoreColor(dashboard.avgScore), display: "inline-flex" }}>
                  <Sparkline values={dashboard.trendValues} />
                </span>
              </div>

              <div style={{ marginTop: 8, fontSize: 12.5, opacity: 0.75 }}>
                Vista: <strong>{dashboard.filterLabel}</strong> · Periodo: <strong>{dashboard.periodLabel}</strong>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Última auditoría</div>
              {dashboard.lastRun ? (
                <>
                  <div style={{ fontWeight: 900 }}>
                    {templateNameById[dashboard.lastRun.audit_template_id] ?? dashboard.lastRun.audit_template_id}
                  </div>
                  <div style={{ opacity: 0.85, marginTop: 4 }}>
                    {fmtDate(dashboard.lastRun.executed_at)} ·{" "}
                    <span style={{ fontWeight: 950, color: scoreColor(dashboard.lastRun.score) }}>
                      {dashboard.lastRun.score === null ? "—" : `${Number(dashboard.lastRun.score).toFixed(2)}%`}
                    </span>
                  </div>

                  <button
                    onClick={() => router.push(`/audits/${dashboard.lastRun!.id}`)}
                    style={{
                      marginTop: 10,
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: "#000",
                      color: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Ver auditoría
                  </button>
                </>
              ) : (
                <div style={{ opacity: 0.8 }}>No hay auditorías enviadas todavía.</div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Sección más débil</div>
              {dashboard.worstSection?.avg_score !== null ? (
                <>
                  <div style={{ fontWeight: 900 }}>{dashboard.worstSection?.section_name}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 28,
                      fontWeight: 950,
                      color: scoreColor(dashboard.worstSection?.avg_score ?? null),
                    }}
                  >
                    {dashboard.worstSection?.avg_score?.toFixed(2)}%
                  </div>
                </>
              ) : (
                <div style={{ opacity: 0.8 }}>—</div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Sección más fuerte</div>
              {dashboard.bestSection?.avg_score !== null ? (
                <>
                  <div style={{ fontWeight: 900 }}>{dashboard.bestSection?.section_name}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 28,
                      fontWeight: 950,
                      color: scoreColor(dashboard.bestSection?.avg_score ?? null),
                    }}
                  >
                    {dashboard.bestSection?.avg_score?.toFixed(2)}%
                  </div>
                </>
              ) : (
                <div style={{ opacity: 0.8 }}>—</div>
              )}
            </div>
          </div>

          {/* ✅ Rankings en 2 columnas: estándares (izq) + secciones (der, sin FAIL/NA) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
            {/* Izquierda: Estándares peor puntuados */}
            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>
                Top 10 estándares peor puntuados (promedio últimas {dashboard.windowSize || 0})
                <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>
                  Basado en preguntas / standards dentro del periodo y vista seleccionados
                </div>
              </div>

              {dashboard.standardsRanking.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No hay datos suficientes para esta vista.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Estándar</th>
                        <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Score prom.</th>
                        <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>FAIL prom.</th>
                        <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>NA prom.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.standardsRanking.map((q) => (
                        <tr key={q.question_id}>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <div style={{ fontWeight: 900, lineHeight: 1.2 }}>{q.text}</div>
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid rgba(0,0,0,0.08)",
                              fontWeight: 950,
                              color: scoreColor(q.avg_score),
                              whiteSpace: "nowrap",
                            }}
                          >
                            {q.avg_score === null ? "—" : `${q.avg_score.toFixed(2)}%`}
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid rgba(0,0,0,0.08)",
                              fontWeight: 900,
                              color: "#000",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {Number(q.avg_fail).toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid rgba(0,0,0,0.08)",
                              fontWeight: 900,
                              color: "#000",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {Number(q.avg_na).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Derecha: Ranking secciones (sin FAIL/NA) */}
            <div style={card}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>
                Ranking de secciones (promedio últimas {dashboard.windowSize || 0})
                <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>
                  ✅ Análisis transversal - agregado por nombre de sección en todas las plantillas
                </div>
              </div>

              {dashboard.sectionRanking.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No hay datos suficientes para esta vista.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Sección</th>
                        <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Score prom.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.sectionRanking.map((s, idx) => (
                        <tr key={`${s.section_name}-${idx}`}>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>{s.section_name}</td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid rgba(0,0,0,0.08)",
                              fontWeight: 950,
                              color: scoreColor(s.avg_score),
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.avg_score === null ? "—" : `${s.avg_score.toFixed(2)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Nota: el dashboard se calcula con auditorías <strong>submitted</strong> con score, filtrando por <strong>periodo</strong> y opcionalmente por <strong>plantilla</strong>.
          </div>
        </div>
      ) : null}

      {/* ---------------------- */}
      {/* HISTORIAL (nuevo con filtros) */}
      {/* ---------------------- */}
      {tab === "history" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 12 }}>Historial</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
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

            {histError ? (
              <div style={{ marginTop: 12, color: "crimson", fontWeight: 900 }}>{histError}</div>
            ) : null}
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

      {/* ---------------------- */}
      {/* AUDITORÍAS DISPONIBLES */}
      {/* ---------------------- */}
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
          {templates.length === 0 ? (
            <p style={{ marginTop: 16, opacity: 0.85 }}>No hay auditorías asignadas a esta área todavía.</p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
