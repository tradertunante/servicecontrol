"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canRunAudits } from "@/lib/auth/permissions";

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

type Area = { id: string; name: string; type: string | null };
type Template = { id: string; name: string };

type AnswerRow = {
  audit_run_id: string;
  question_id: string;
  result: string | null; // "FAIL" | "NA"
  comment: string | null;
};

type QuestionMeta = {
  id: string;
  text: string;
  section_id: string;
  section_name: string;
};

type SectionTotal = {
  section_id: string;
  section_name: string;
  total_questions: number;
};

type ExceptionItem = {
  question_id: string;
  question_text: string;
  result: "FAIL" | "NA";
  comment: string | null;
};

type SectionAgg = {
  section_id: string;
  section_name: string;
  total_questions: number;
  fail_count: number;
  na_count: number;
  score: number | null;
  items: ExceptionItem[];
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

function scoreColor(score: number | null) {
  if (score === null || Number.isNaN(score)) return "#666";
  if (score >= 95) return "#0f766e";
  if (score >= 85) return "#b45309";
  return "#b91c1c";
}

function badgeStyle(kind: "FAIL" | "NA") {
  if (kind === "FAIL") {
    return {
      background: "rgba(185, 28, 28, 0.12)",
      border: "1px solid rgba(185, 28, 28, 0.35)",
      color: "#7f1d1d",
    };
  }
  return {
    background: "rgba(2, 132, 199, 0.12)",
    border: "1px solid rgba(2, 132, 199, 0.35)",
    color: "#075985",
  };
}

function chip(text: string, kind?: "FAIL" | "NA") {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  if (!kind) {
    return (
      <span
        style={{
          ...base,
          background: "rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.12)",
          color: "#111",
        }}
      >
        {text}
      </span>
    );
  }

  const c = badgeStyle(kind);
  return (
    <span style={{ ...base, ...c }}>
      {text}
    </span>
  );
}

export default function AuditRunViewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const auditRunId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);

  const [run, setRun] = useState<AuditRunRow | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [executorName, setExecutorName] = useState<string | null>(null);

  const [totals, setTotals] = useState<Record<string, SectionTotal>>({});
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [qMeta, setQMeta] = useState<Record<string, QuestionMeta>>({});

  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!auditRunId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor"], "/areas");
        if (!p) return;
        setProfile(p);

        if (!canRunAudits(p.role)) {
          setError("No tienes permisos para ver auditorías.");
          setLoading(false);
          return;
        }

        // Run
        const { data: runData, error: runErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
          .eq("id", auditRunId)
          .single();

        if (runErr || !runData) throw runErr ?? new Error("No se encontró la auditoría.");
        const r = runData as AuditRunRow;
        setRun(r);

        // Area + Template
        const [{ data: areaData, error: areaErr }, { data: tplData, error: tplErr }] =
          await Promise.all([
            supabase.from("areas").select("id,name,type").eq("id", r.area_id).single(),
            supabase.from("audit_templates").select("id,name").eq("id", r.audit_template_id).single(),
          ]);

        if (areaErr) throw areaErr;
        if (tplErr) throw tplErr;

        setArea(areaData as Area);
        setTemplate(tplData as Template);

        // Executor name
        if (r.executed_by) {
          const { data: execData, error: execErr } = await supabase
            .from("profiles")
            .select("id,full_name")
            .eq("id", r.executed_by)
            .single();

          if (!execErr && execData) setExecutorName((execData as any).full_name ?? r.executed_by);
          else setExecutorName(r.executed_by);
        }

        // Totales por sección del template
        const { data: tqData, error: tqErr } = await supabase
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
          .eq("active", true)
          .eq("audit_sections.audit_template_id", r.audit_template_id);

        if (tqErr) throw tqErr;

        const totalsMap: Record<string, SectionTotal> = {};
        for (const row of (tqData ?? []) as any[]) {
          const secId = (row.audit_sections?.id ?? row.audit_section_id) as string;
          const secName = (row.audit_sections?.name ?? "Sin sección") as string;
          if (!secId) continue;

          if (!totalsMap[secId]) {
            totalsMap[secId] = { section_id: secId, section_name: secName, total_questions: 0 };
          }
          totalsMap[secId].total_questions += 1;
        }
        setTotals(totalsMap);

        // Answers
        const { data: aData, error: aErr } = await supabase
          .from("audit_answers")
          .select("audit_run_id,question_id,result,comment")
          .eq("audit_run_id", auditRunId);

        if (aErr) throw aErr;
        const aRows = (aData ?? []) as AnswerRow[];
        setAnswers(aRows);

        // Meta preguntas (sin embed de audit_answers -> audit_questions)
        const questionIds = Array.from(new Set(aRows.map((x) => x.question_id).filter(Boolean)));

        if (questionIds.length) {
          const { data: qData, error: qErr } = await supabase
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

          if (qErr) throw qErr;

          const map: Record<string, QuestionMeta> = {};
          for (const q of (qData ?? []) as any[]) {
            const secId = (q.audit_sections?.id ?? q.audit_section_id ?? "unknown") as string;
            const secName = (q.audit_sections?.name ?? "Sin sección") as string;
            map[q.id] = {
              id: q.id,
              text: q.text ?? `(pregunta ${q.id})`,
              section_id: secId,
              section_name: secName,
            };
          }
          setQMeta(map);
        }

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando auditoría.");
      }
    })();
  }, [auditRunId, router]);

  const sections: SectionAgg[] = useMemo(() => {
    const agg: Record<string, SectionAgg> = {};
    for (const t of Object.values(totals)) {
      agg[t.section_id] = {
        section_id: t.section_id,
        section_name: t.section_name,
        total_questions: t.total_questions,
        fail_count: 0,
        na_count: 0,
        score: null,
        items: [],
      };
    }

    for (const a of answers) {
      const res = String(a.result ?? "").toUpperCase();
      if (res !== "FAIL" && res !== "NA") continue;

      const meta = qMeta[a.question_id];
      const secId = meta?.section_id ?? "unknown";
      const secName = meta?.section_name ?? "Sin sección";

      if (!agg[secId]) {
        agg[secId] = {
          section_id: secId,
          section_name: secName,
          total_questions: 0,
          fail_count: 0,
          na_count: 0,
          score: null,
          items: [],
        };
      }

      if (res === "FAIL") agg[secId].fail_count += 1;
      if (res === "NA") agg[secId].na_count += 1;

      agg[secId].items.push({
        question_id: a.question_id,
        question_text: meta?.text ?? `(pregunta ${a.question_id})`,
        result: res as "FAIL" | "NA",
        comment: a.comment ?? null,
      });
    }

    for (const sec of Object.values(agg)) {
      const denom = Math.max(0, sec.total_questions - sec.na_count);
      const pass = Math.max(0, denom - sec.fail_count);
      sec.score = denom === 0 ? null : (pass / denom) * 100;
      sec.items.sort((x, y) => {
        if (x.result !== y.result) return x.result === "FAIL" ? -1 : 1;
        return x.question_text.localeCompare(y.question_text);
      });
    }

    return Object.values(agg).sort((a, b) => a.section_name.localeCompare(b.section_name));
  }, [totals, answers, qMeta]);

  const crumbLink: React.CSSProperties = {
    cursor: "pointer",
    textDecoration: "underline",
    fontWeight: 800,
  };

  const headerBoxStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    padding: 18,
    maxWidth: 1100,
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 18,
    maxWidth: 1100,
  };

  const thBase: React.CSSProperties = {
    padding: "10px 8px",
    borderBottom: "1px solid rgba(0,0,0,0.15)",
    whiteSpace: "nowrap",
    fontWeight: 900,
    fontSize: 14,
    textAlign: "left",
  };

  const tdBase: React.CSSProperties = {
    padding: "10px 8px",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    verticalAlign: "top",
    fontSize: 14,
  };

  const numCell: React.CSSProperties = { ...tdBase, textAlign: "right", fontWeight: 900 };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 44, marginBottom: 10 }}>Detalle de auditoría</h1>
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 44, marginBottom: 10 }}>Detalle de auditoría</h1>
        <p style={{ color: "crimson", fontWeight: 900 }}>{error}</p>
        <button
          onClick={() => router.push("/areas")}
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Volver a áreas
        </button>
      </main>
    );
  }

  if (!run) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 44, marginBottom: 10 }}>Detalle de auditoría</h1>
        <p>No se encontró la auditoría.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      {/* Breadcrumb */}
      <div style={{ opacity: 0.85, marginBottom: 12 }}>
        <span style={crumbLink} onClick={() => router.push("/areas")}>
          Áreas
        </span>
        {" / "}
        <span
          style={crumbLink}
          onClick={() => router.push(`/areas/${run.area_id}?tab=history`)}
        >
          {area?.name ?? "Área"}
        </span>
        {" / "}
        <span style={{ fontWeight: 900 }}>Detalle auditoría</span>
      </div>

      <h1 style={{ fontSize: 52, marginBottom: 14 }}>Detalle de auditoría</h1>

      <div style={headerBoxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ lineHeight: 1.8 }}>
            <div>
              <strong>ID:</strong> {run.id}
            </div>
            <div>
              <strong>Área:</strong> {area?.name ?? run.area_id} {area?.type ? `(${area.type})` : ""}
            </div>
            <div>
              <strong>Auditoría:</strong> {template?.name ?? run.audit_template_id}
            </div>
            <div>
              <strong>Estado:</strong> {run.status ?? "—"}
            </div>
            <div>
              <strong>Fecha:</strong> {fmtDate(run.executed_at)}
            </div>
            <div>
              <strong>Ejecutada por:</strong> {executorName ?? "—"}
            </div>
            <div>
              <strong>Score:</strong>{" "}
              <span style={{ color: scoreColor(run.score), fontWeight: 950 }}>
                {run.score ?? "—"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <button
              onClick={() => router.push(`/areas/${run.area_id}?tab=history`)}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#000",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                height: 44,
              }}
            >
              ← Volver al historial
            </button>

            <button
              onClick={() => router.push("/areas")}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                height: 44,
              }}
            >
              Volver a áreas
            </button>
          </div>
        </div>

        {run.notes ? (
          <div style={{ marginTop: 12 }}>
            <strong>Notas:</strong> {run.notes}
          </div>
        ) : null}
      </div>

      <div style={{ height: 14 }} />

      <div style={cardStyle}>
        <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 10 }}>
          Desglose por secciones
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <colgroup>
              <col style={{ width: "44%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>

            <thead>
              <tr>
                <th style={thBase}>Sección</th>
                <th style={{ ...thBase, textAlign: "right" }}>Total</th>
                <th style={{ ...thBase, textAlign: "right" }}>FAIL</th>
                <th style={{ ...thBase, textAlign: "right" }}>NA</th>
                <th style={{ ...thBase, textAlign: "right" }}>Score sección</th>
                <th style={thBase}>Hallazgos</th>
              </tr>
            </thead>

            <tbody>
              {sections.map((s) => {
                const isOpen = openSectionId === s.section_id;
                const findings = s.fail_count + s.na_count;

                return (
                  <React.Fragment key={s.section_id}>
                    <tr>
                      <td style={tdBase}>{s.section_name}</td>
                      <td style={numCell}>{s.total_questions}</td>
                      <td style={numCell}>{s.fail_count}</td>
                      <td style={numCell}>{s.na_count}</td>
                      <td style={numCell}>{s.score === null ? "—" : `${s.score.toFixed(2)}%`}</td>
                      <td style={tdBase}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {findings === 0 ? chip("0", undefined) : chip(String(findings), s.fail_count > 0 ? "FAIL" : "NA")}

                          <button
                            onClick={() => setOpenSectionId(isOpen ? null : s.section_id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(0,0,0,0.2)",
                              background: isOpen ? "#000" : "#fff",
                              color: isOpen ? "#fff" : "#000",
                              fontWeight: 900,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isOpen ? "Ocultar" : "Ver detalle"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "10px 8px" }}>
                          <div
                            style={{
                              background: "rgba(0,0,0,0.04)",
                              border: "1px solid rgba(0,0,0,0.10)",
                              borderRadius: 14,
                              padding: 12,
                            }}
                          >
                            {s.items.length === 0 ? (
                              <div style={{ opacity: 0.8 }}>
                                No hay hallazgos en esta sección (todo PASS implícito).
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 10 }}>
                                {s.items.map((it) => (
                                  <div
                                    key={it.question_id}
                                    style={{
                                      background: "#fff",
                                      border: "1px solid rgba(0,0,0,0.10)",
                                      borderRadius: 12,
                                      padding: 12,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 10,
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      <div style={{ fontWeight: 950 }}>{it.question_text}</div>
                                      {chip(it.result, it.result)}
                                    </div>

                                    {it.comment ? (
                                      <div style={{ marginTop: 6 }}>
                                        <strong>Comentario:</strong> {it.comment}
                                      </div>
                                    ) : (
                                      <div style={{ marginTop: 6, opacity: 0.7 }}>Sin comentario</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
          * Score sección = (PASS / (Total - NA)). PASS es implícito salvo excepciones FAIL/NA.
        </div>
      </div>
    </main>
  );
}
