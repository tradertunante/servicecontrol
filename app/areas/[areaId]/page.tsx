"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canRunAudits } from "@/lib/auth/permissions";
import BackButton from "@/app/components/BackButton";

/* =====================
   TYPES
===================== */
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
  denom: number;
  pass: number;
  score: number | null;
};

type RunAgg = {
  run: AuditRunRow;
  templateName: string;
  executedByName: string | null;
  sections: SectionAgg[];
};

/* =====================
   HELPERS
===================== */
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number | null) {
  if (typeof score !== "number") return "#000";
  if (score < 60) return "#c62828";
  if (score < 80) return "#ef6c00";
  return "#000";
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 34;
  const pad = 3;

  if (!values.length) return <div style={{ opacity: 0.6 }}>—</div>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const pts = values.map((v, i) => ({
    x: pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1),
    y: pad + (h - pad * 2) * (1 - (v - min) / span),
  }));

  const d = pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg width={w} height={h}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx={pts.at(-1)!.x} cy={pts.at(-1)!.y} r="2.5" fill="currentColor" />
    </svg>
  );
}

/* =====================
   PAGE
===================== */
export default function AreaPage() {
  const router = useRouter();
  const params = useParams<{ areaId: string }>();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") ?? "history") as "history" | "templates" | "dashboard";
  const areaId = params.areaId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [area, setArea] = useState<Area | null>(null);

  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Record<string, string>>({});
  const [executorNameById, setExecutorNameById] = useState<Record<string, string>>({});
  const [totalsByTemplate, setTotalsByTemplate] = useState<Record<string, Record<string, SectionTotal>>>({});
  const [exceptionsByRun, setExceptionsByRun] = useState<Record<string, Record<string, { fail: number; na: number }>>>(
    {}
  );

  const [templateFilter, setTemplateFilter] = useState("ALL");

  /* =====================
     LOAD DATA
  ===================== */
  useEffect(() => {
    if (!areaId) return;

    (async () => {
      try {
        setLoading(true);

        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/areas");
        if (!p) return;
        if (!canRunAudits(p.role)) throw new Error("Sin permisos");

        setProfile(p);

        const { data: areaData } = await supabase.from("areas").select("*").eq("id", areaId).single();
        setArea(areaData);

        const { data: tData } = await supabase
          .from("audit_templates")
          .select("id,name,active")
          .eq("area_id", areaId);

        setTemplates((tData ?? []).filter((t) => t.active !== false));

        const { data: runData } = await supabase
          .from("audit_runs")
          .select("*")
          .eq("area_id", areaId)
          .order("executed_at", { ascending: false })
          .limit(80);

        const validRuns = (runData ?? []).filter((r) => r.status === "submitted");
        setRuns(validRuns);

        const templateIds = [...new Set(validRuns.map((r) => r.audit_template_id))];
        const runIds = validRuns.map((r) => r.id);

        if (templateIds.length) {
          const { data } = await supabase.from("audit_templates").select("id,name").in("id", templateIds);
          const map: Record<string, string> = {};
          data?.forEach((t) => (map[t.id] = t.name));
          setTemplateNameById(map);
        }

        if (runIds.length) {
          const { data } = await supabase
            .from("audit_answers")
            .select("audit_run_id,result,question_id")
            .in("audit_run_id", runIds);

          const ex: any = {};
          data?.forEach((a) => {
            if (!ex[a.audit_run_id]) ex[a.audit_run_id] = {};
            if (!ex[a.audit_run_id][a.question_id]) ex[a.audit_run_id][a.question_id] = { fail: 0, na: 0 };
            if (a.result === "FAIL") ex[a.audit_run_id][a.question_id].fail++;
            if (a.result === "NA") ex[a.audit_run_id][a.question_id].na++;
          });

          setExceptionsByRun(ex);
        }

        setLoading(false);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    })();
  }, [areaId, router]);

  /* =====================
     DASHBOARD AGG
  ===================== */
  const dashboard = useMemo(() => {
    const sorted = [...runs].filter((r) => typeof r.score === "number");

    const lastN = sorted.slice(0, 4);
    const avgScore =
      lastN.length === 0 ? null : lastN.reduce((s, r) => s + (r.score ?? 0), 0) / lastN.length;

    const trendValues = sorted.slice(0, 12).reverse().map((r) => clamp(r.score ?? 0, 0, 100));

    const sectionRanking: { section_name: string; avg_score: number | null }[] = [];

    const worst = sectionRanking.find((s) => typeof s.avg_score === "number") ?? null;
    const best = [...sectionRanking].reverse().find((s) => typeof s.avg_score === "number") ?? null;

    return {
      avgScore,
      trendValues,
      worst,
      best,
      windowSize: lastN.length,
    };
  }, [runs]);

  /* =====================
     UI
  ===================== */
  if (loading) return <main style={{ padding: 24 }}>Cargando…</main>;
  if (error) return <main style={{ padding: 24, color: "crimson" }}>{error}</main>;

  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    padding: 18,
    background: "#fff",
  };

  return (
    <main style={{ padding: 24 }}>
      <BackButton fallback="/areas" />
      <h1 style={{ fontSize: 48 }}>{area?.name}</h1>

      {tab === "dashboard" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={card}>
            <strong>Score promedio</strong>
            <div style={{ fontSize: 32, color: scoreColor(dashboard.avgScore) }}>
              {typeof dashboard.avgScore === "number" ? `${dashboard.avgScore.toFixed(2)}%` : "—"}
            </div>
            <Sparkline values={dashboard.trendValues} />
          </div>

          <div style={card}>
            <strong>Sección más débil</strong>
            {dashboard.worst && typeof dashboard.worst.avg_score === "number" ? (
              <div style={{ color: scoreColor(dashboard.worst.avg_score) }}>
                {dashboard.worst.avg_score.toFixed(2)}%
              </div>
            ) : (
              "—"
            )}
          </div>

          <div style={card}>
            <strong>Sección más fuerte</strong>
            {dashboard.best && typeof dashboard.best.avg_score === "number" ? (
              <div style={{ color: scoreColor(dashboard.best.avg_score) }}>
                {dashboard.best.avg_score.toFixed(2)}%
              </div>
            ) : (
              "—"
            )}
          </div>
        </div>
      )}
    </main>
  );
}
