"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AuditRun = {
  id: string;
  area_id: string;
  audit_template_id: string;
  status: string | null;
  score: number | null;
  room_number?: string | null;
  executed_at: string | null;
  created_at?: string | null;
};

type Area = { id: string; name: string; type: string | null };
type Template = { id: string; name: string };

type AnswerRow = {
  question_id: string;
  result: string | null; // "FAIL" / "NA" / null
  answer: string | null; // fallback por compatibilidad
  comment: string | null;
};

type QuestionRow = {
  id: string;
  text: string;
  audit_section_id: string | null;
  weight: number | null;
};

type SectionRow = {
  id: string;
  name: string;
};

type Item = {
  question_id: string;
  question_text: string;
  section_id: string;
  section_name: string;
  status: "FAIL" | "NA" | "OK";
  comment: string | null;
};

type GroupedSection = {
  section_id: string;
  section_name: string;
  items: Item[];
  fail: number;
  na: number;
  ok: number;
};

function normalizeStatus(a: AnswerRow | undefined): "FAIL" | "NA" | "OK" {
  const raw = (a?.result ?? a?.answer ?? "").toString().trim().toUpperCase();
  if (raw === "FAIL") return "FAIL";
  if (raw === "NA" || raw === "N/A") return "NA";
  return "OK";
}

function pageWrapStyle(): CSSProperties {
  return {
    padding: 24,
    width: "100%",
    maxWidth: "none",
  };
}

function cardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.72)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
    backdropFilter: "blur(10px)",
  };
}

function softBtnStyle(isDark = false): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    background: isDark ? "#111" : "#fff",
    color: isDark ? "#fff" : "#111",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.15)",
    background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#111",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function statCardStyle(): CSSProperties {
  return {
    ...cardStyle(),
    padding: 16,
    minWidth: 160,
  };
}

function badgeStyle(status: "FAIL" | "NA" | "OK"): CSSProperties {
  if (status === "FAIL") {
    return {
      background: "var(--danger-bg)",
      color: "#b91c1c",
      border: "1px solid var(--danger-border)",
    };
  }
  if (status === "NA") {
    return {
      background: "var(--neutral-bg)",
      color: "#374151",
      border: "1px solid var(--neutral-border)",
    };
  }
  return {
    background: "var(--ok-bg)",
    color: "#15803d",
    border: "1px solid var(--ok-border)",
  };
}

export default function AuditRunSectionDetailPageClient({
  areaId,
  runId,
}: {
  areaId: string;
  runId: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [run, setRun] = useState<AuditRun | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);

  const [items, setItems] = useState<Item[]>([]);

  const [filter, setFilter] = useState<"ALL" | "FAIL" | "NA" | "OK">("ALL");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!areaId || !runId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: runData, error: runErr } = await supabase
          .from("audit_runs")
          .select("id,area_id,audit_template_id,status,score,room_number,executed_at,created_at")
          .eq("id", runId)
          .single();

        if (runErr || !runData) throw runErr ?? new Error("No se encontró la auditoría.");

        if (runData.area_id !== areaId) {
          throw new Error("Esta auditoría no pertenece a esta área.");
        }

        setRun(runData as AuditRun);

        const [{ data: areaData, error: areaErr }, { data: tplData, error: tplErr }] =
          await Promise.all([
            supabase.from("areas").select("id,name,type").eq("id", areaId).single(),
            supabase
              .from("audit_templates")
              .select("id,name")
              .eq("id", runData.audit_template_id)
              .single(),
          ]);

        if (areaErr) throw areaErr;
        if (tplErr) throw tplErr;

        setArea(areaData as Area);
        setTemplate(tplData as Template);

        const { data: ansData, error: ansErr } = await supabase
          .from("audit_answers")
          .select("question_id,result,answer,comment")
          .eq("audit_run_id", runId);

        if (ansErr) throw ansErr;

        const answers = (ansData ?? []) as AnswerRow[];
        const qids = answers.map((a) => a.question_id).filter(Boolean);

        if (qids.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        const { data: qData, error: qErr } = await supabase
          .from("audit_questions")
          .select("id,text,audit_section_id,weight")
          .in("id", qids);

        if (qErr) throw qErr;

        const questions = (qData ?? []) as QuestionRow[];

        const sectionIds = Array.from(
          new Set(
            questions
              .map((q) => q.audit_section_id)
              .filter((x): x is string => typeof x === "string" && x.length > 0)
          )
        );

        let sections: SectionRow[] = [];
        if (sectionIds.length > 0) {
          const { data: sData, error: sErr } = await supabase
            .from("audit_sections")
            .select("id,name")
            .in("id", sectionIds);

          if (sErr) throw sErr;
          sections = (sData ?? []) as SectionRow[];
        }

        const sectionNameById = new Map<string, string>();
        for (const s of sections) sectionNameById.set(s.id, s.name);

        const ansByQid = new Map<string, AnswerRow>();
        for (const a of answers) ansByQid.set(a.question_id, a);

        const built: Item[] = questions.map((q) => {
          const a = ansByQid.get(q.id);
          const section_id = q.audit_section_id ?? "no_section";
          const section_name = sectionNameById.get(section_id) ?? "Sin sección";

          return {
            question_id: q.id,
            question_text: q.text,
            section_id,
            section_name,
            status: normalizeStatus(a),
            comment: (a?.comment ?? "").trim() || null,
          };
        });

        built.sort((x, y) => {
          const sx = (x.section_name ?? "").toLowerCase();
          const sy = (y.section_name ?? "").toLowerCase();
          if (sx !== sy) return sx.localeCompare(sy);
          return x.question_text.localeCompare(y.question_text);
        });

        setItems(built);

        const opens: Record<string, boolean> = {};
        for (const it of built) opens[it.section_id] = true;
        setOpenSections(opens);

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando detalle por sección.");
      }
    })();
  }, [areaId, runId, router]);

  const grouped = useMemo<GroupedSection[]>(() => {
    const map = new Map<string, GroupedSection>();

    const filtered = items.filter((it) => (filter === "ALL" ? true : it.status === filter));

    for (const it of filtered) {
      const key = it.section_id;
      if (!map.has(key)) {
        map.set(key, {
          section_id: it.section_id,
          section_name: it.section_name,
          items: [],
          fail: 0,
          na: 0,
          ok: 0,
        });
      }

      const bucket = map.get(key)!;
      bucket.items.push(it);

      if (it.status === "FAIL") bucket.fail += 1;
      else if (it.status === "NA") bucket.na += 1;
      else bucket.ok += 1;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.section_name.toLowerCase().localeCompare(b.section_name.toLowerCase())
    );
  }, [items, filter]);

  const totals = useMemo(() => {
    let fail = 0;
    let na = 0;
    let ok = 0;

    for (const it of items) {
      if (it.status === "FAIL") fail += 1;
      else if (it.status === "NA") na += 1;
      else ok += 1;
    }

    return { fail, na, ok, total: items.length };
  }, [items]);

  const displayedTotals = useMemo(() => {
    let fail = 0;
    let na = 0;
    let ok = 0;
    let total = 0;

    for (const sec of grouped) {
      fail += sec.fail;
      na += sec.na;
      ok += sec.ok;
      total += sec.items.length;
    }

    return { fail, na, ok, total };
  }, [grouped]);

  const scoreLabel =
    typeof run?.score === "number"
      ? `${Number.isInteger(run.score) ? run.score : run.score.toFixed(1)}%`
      : "-";

  const executedAtLabel = run?.executed_at
    ? new Date(run.executed_at).toLocaleString()
    : "No ejecutada";

  function toggleAllSections(nextOpen: boolean) {
    const updated: Record<string, boolean> = {};
    for (const sec of grouped) updated[sec.section_id] = nextOpen;
    setOpenSections((prev) => ({ ...prev, ...updated }));
  }

  if (loading) {
    return (
      <main style={pageWrapStyle()}>
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>Detalle por sección</h1>
        <p>Cargando…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={pageWrapStyle()}>
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>Detalle por sección</h1>
        <p style={{ color: "crimson", fontWeight: 800 }}>{error}</p>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/areas/${areaId}`)}
            style={softBtnStyle(false)}
          >
            Volver al área
          </button>

          <button
            onClick={() => router.push(`/areas/${areaId}/history`)}
            style={softBtnStyle(true)}
          >
            Volver al historial
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrapStyle()}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ minWidth: 300, flex: "1 1 560px" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              opacity: 0.6,
              marginBottom: 8,
            }}
          >
            Audit review
          </div>

          <h1 style={{ fontSize: 48, lineHeight: 1.05, margin: 0 }}>Detalle por sección</h1>

          <div style={{ marginTop: 16, ...cardStyle(), padding: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                lineHeight: 1.6,
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Área</div>
                <div style={{ fontWeight: 900 }}>
                  {area?.name ?? areaId} {area?.type ? `(${area.type})` : ""}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Auditoría</div>
                <div style={{ fontWeight: 900 }}>{template?.name ?? run?.audit_template_id}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Estado</div>
                <div style={{ fontWeight: 900 }}>{run?.status ?? "-"}</div>
              </div>

              {run?.room_number ? (
                <div>
                  <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Habitación</div>
                  <div style={{ fontWeight: 900 }}>{run.room_number}</div>
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Score</div>
                <div style={{ fontWeight: 900 }}>{scoreLabel}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Ejecutada</div>
                <div style={{ fontWeight: 900 }}>{executedAtLabel}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Run ID</div>
                <div style={{ fontWeight: 900, wordBreak: "break-all" }}>{run?.id}</div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            flex: "0 0 auto",
          }}
        >
          <button
            onClick={() => router.push(`/reports/audit/${runId}`)}
            style={softBtnStyle(true)}
          >
            Abrir reporte
          </button>

          <button
            onClick={() => window.print()}
            style={softBtnStyle(false)}
          >
            Imprimir
          </button>

          <button
            onClick={() => router.push(`/areas/${areaId}/history`)}
            style={softBtnStyle(false)}
          >
            Volver al historial
          </button>

          <button
            onClick={() => router.push(`/areas/${areaId}`)}
            style={softBtnStyle(false)}
          >
            Volver al área
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <div style={statCardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Total respuestas</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{totals.total}</div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>FAIL</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4, color: "#b91c1c" }}>
            {totals.fail}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>NA</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4, color: "#374151" }}>
            {totals.na}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>OK</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4, color: "#15803d" }}>
            {totals.ok}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          ...cardStyle(),
          padding: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900 }}>Filtro:</div>

        {(["ALL", "FAIL", "NA", "OK"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={pillStyle(filter === f)}
          >
            {f === "ALL" ? "Todos" : f}
          </button>
        ))}

        <div style={{ width: 1, height: 28, background: "rgba(0,0,0,0.08)", margin: "0 6px" }} />

        <button
          onClick={() => toggleAllSections(true)}
          style={softBtnStyle(false)}
        >
          Expandir todo
        </button>

        <button
          onClick={() => toggleAllSections(false)}
          style={softBtnStyle(false)}
        >
          Colapsar todo
        </button>

        <div style={{ marginLeft: "auto", opacity: 0.82, fontSize: 14 }}>
          Mostrando: <strong>{displayedTotals.total}</strong> · FAIL:{" "}
          <strong>{displayedTotals.fail}</strong> · NA: <strong>{displayedTotals.na}</strong> · OK:{" "}
          <strong>{displayedTotals.ok}</strong>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        {grouped.map((sec) => {
          const isOpen = openSections[sec.section_id] ?? true;

          return (
            <section
              key={sec.section_id}
              style={{
                ...cardStyle(),
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() =>
                      setOpenSections((prev) => ({
                        ...prev,
                        [sec.section_id]: !isOpen,
                      }))
                    }
                    style={softBtnStyle(false)}
                  >
                    {isOpen ? "Ocultar" : "Ver"}
                  </button>

                  <div style={{ fontSize: 22, fontWeight: 900 }}>{sec.section_name}</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "#fff",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    Total: {sec.items.length}
                  </span>

                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      ...badgeStyle("FAIL"),
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    FAIL: {sec.fail}
                  </span>

                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      ...badgeStyle("NA"),
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    NA: {sec.na}
                  </span>

                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      ...badgeStyle("OK"),
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    OK: {sec.ok}
                  </span>
                </div>
              </div>

              {isOpen ? (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {sec.items.map((it, idx) => (
                    <article
                      key={it.question_id}
                      style={{
                        border: "1px solid rgba(0,0,0,0.07)",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontWeight: 900, flex: "1 1 620px", minWidth: 260 }}>
                          {idx + 1}. {it.question_text}
                        </div>

                        <span
                          style={{
                            ...badgeStyle(it.status),
                            padding: "5px 10px",
                            borderRadius: 999,
                            fontWeight: 900,
                            fontSize: 12,
                            height: "fit-content",
                          }}
                        >
                          {it.status}
                        </span>
                      </div>

                      {it.comment ? (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 12,
                            background: "rgba(0,0,0,0.03)",
                            lineHeight: 1.55,
                          }}
                        >
                          <strong>Comentario:</strong> {it.comment}
                        </div>
                      ) : (
                        <div style={{ marginTop: 10, opacity: 0.5, fontSize: 13 }}>
                          Sin comentario.
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        {items.length === 0 ? (
          <div style={{ ...cardStyle(), padding: 18, opacity: 0.82 }}>
            Esta auditoría no tiene respuestas en <strong>audit_answers</strong> todavía.
          </div>
        ) : null}
      </div>
    </main>
  );
}
