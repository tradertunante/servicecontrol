"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";

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

type TemplateRow = {
  id: string;
  name: string;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
};

type SectionRow = {
  id: string;
  name: string;
  active: boolean | null;
  created_at: string | null;
};

type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  weight: number | null;
  require_photo: boolean;
  require_comment: boolean;
  require_signature: boolean;
  active: boolean;
  order: number | null;
  created_at: string | null;
  tag?: string | null;
  classification?: string | null;
};

type AnswerRow = {
  id: string;
  audit_run_id: string;
  question_id: string;
  answer: "FAIL" | "NA";
  comment: string | null;
  photo_path: string | null;
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function scoreColor(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "#000";
  if (score < 60) return "#c62828";
  if (score < 80) return "#ef6c00";
  return "#000";
}

export default function AuditRunPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const runId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [run, setRun] = useState<AuditRunRow | null>(null);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answersByQ, setAnswersByQ] = useState<Record<string, AnswerRow>>({});

  // -----------------------
  // Load
  // -----------------------
  useEffect(() => {
    if (!runId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: uErr,
        } = await supabase.auth.getUser();

        if (uErr || !user) {
          router.push("/login");
          return;
        }

        // 1) Run (IMPORTANTE: NO pedimos name aquí)
        const { data: rData, error: rErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
          .eq("id", runId)
          .single();

        if (rErr || !rData) throw rErr ?? new Error("Auditoría no encontrada.");
        const r = rData as AuditRunRow;
        setRun(r);

        // 2) Template + Area
        const [{ data: tData, error: tErr }, { data: aData, error: aErr }] = await Promise.all([
          supabase.from("audit_templates").select("id,name").eq("id", r.audit_template_id).single(),
          supabase.from("areas").select("id,name,type").eq("id", r.area_id).single(),
        ]);

        if (tErr || !tData) throw tErr ?? new Error("Plantilla no encontrada.");
        if (aErr || !aData) throw aErr ?? new Error("Área no encontrada.");

        setTemplate(tData as TemplateRow);
        setArea(aData as AreaRow);

        // 3) Sections
        const { data: sData, error: sErr } = await supabase
          .from("audit_sections")
          .select("id,name,active,created_at")
          .eq("audit_template_id", r.audit_template_id)
          .eq("active", true)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (sErr) throw sErr;
        const secs = (sData ?? []) as SectionRow[];
        setSections(secs);

        // 4) Questions (solo activas)
        const secIds = secs.map((s) => s.id);
        if (secIds.length) {
          const { data: qData, error: qErr } = await supabase
            .from("audit_questions")
            .select(
              "id,audit_section_id,text,weight,require_photo,require_comment,require_signature,active,order,created_at,tag,classification"
            )
            .in("audit_section_id", secIds)
            .eq("active", true)
            .order("audit_section_id", { ascending: true })
            .order("order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true });

          if (qErr) throw qErr;
          setQuestions((qData ?? []) as QuestionRow[]);
        } else {
          setQuestions([]);
        }

        // 5) Answers (solo excepciones FAIL/NA)
        const { data: ansData, error: ansErr } = await supabase
          .from("audit_answers")
          .select("id,audit_run_id,question_id,answer,comment,photo_path")
          .eq("audit_run_id", runId);

        if (ansErr) throw ansErr;

        const map: Record<string, AnswerRow> = {};
        for (const row of (ansData ?? []) as any[]) {
          if (!row?.question_id) continue;
          map[row.question_id] = row as AnswerRow;
        }
        setAnswersByQ(map);

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando auditoría.");
      }
    })();
  }, [runId, router]);

  // -----------------------
  // Derived stats
  // -----------------------
  const totals = useMemo(() => {
    const total = questions.length;
    let fail = 0;
    let na = 0;

    for (const q of questions) {
      const a = answersByQ[q.id];
      if (!a) continue;
      if (a.answer === "FAIL") fail += 1;
      if (a.answer === "NA") na += 1;
    }

    // PASS implícito = preguntas sin fila en audit_answers
    const denom = Math.max(0, total - na);
    const pass = Math.max(0, denom - fail);
    const score = denom === 0 ? null : Math.round((pass / denom) * 100 * 100) / 100;

    return { total, fail, na, denom, pass, score };
  }, [questions, answersByQ]);

  const grouped = useMemo(() => {
    const bySection: Record<string, QuestionRow[]> = {};
    for (const q of questions) {
      if (!bySection[q.audit_section_id]) bySection[q.audit_section_id] = [];
      bySection[q.audit_section_id].push(q);
    }
    return bySection;
  }, [questions]);

  // -----------------------
  // Save helpers
  // -----------------------
  async function setAnswer(questionId: string, next: "FAIL" | "NA" | null) {
    if (!runId) return;

    setSaving(true);
    setError(null);

    try {
      // next=null => PASS implícito => borramos fila si existe
      if (next === null) {
        const current = answersByQ[questionId];
        if (current?.id) {
          const { error: delErr } = await supabase.from("audit_answers").delete().eq("id", current.id);
          if (delErr) throw delErr;

          const copy = { ...answersByQ };
          delete copy[questionId];
          setAnswersByQ(copy);
        }
        setSaving(false);
        return;
      }

      // Upsert (excepción)
      const current = answersByQ[questionId];

      const payload = {
        audit_run_id: runId,
        question_id: questionId,
        answer: next as "FAIL" | "NA", // nunca null
        comment: current?.comment ?? null,
        photo_path: current?.photo_path ?? null,
      };

      const { data, error: upErr } = await supabase
        .from("audit_answers")
        .upsert(payload, { onConflict: "audit_run_id,question_id" })
        .select("id,audit_run_id,question_id,answer,comment,photo_path")
        .single();

      if (upErr || !data) throw upErr ?? new Error("No se pudo guardar.");

      setAnswersByQ({ ...answersByQ, [questionId]: data as AnswerRow });
      setSaving(false);
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? "No se pudo guardar la respuesta.");
    }
  }

  async function setComment(questionId: string, comment: string) {
    setSaving(true);
    setError(null);

    try {
      const current = answersByQ[questionId];
      // Solo guardamos comentarios en excepciones (FAIL/NA). Si no hay excepción, no hacemos nada.
      if (!current?.id) {
        setSaving(false);
        return;
      }

      const { error: upErr } = await supabase.from("audit_answers").update({ comment }).eq("id", current.id);
      if (upErr) throw upErr;

      setAnswersByQ({ ...answersByQ, [questionId]: { ...current, comment } });
      setSaving(false);
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? "No se pudo guardar el comentario.");
    }
  }

  async function setPhotoPath(questionId: string, photo_path: string | null) {
    setSaving(true);
    setError(null);

    try {
      const current = answersByQ[questionId];
      if (!current?.id) {
        setSaving(false);
        return;
      }

      const { error: upErr } = await supabase.from("audit_answers").update({ photo_path }).eq("id", current.id);
      if (upErr) throw upErr;

      setAnswersByQ({ ...answersByQ, [questionId]: { ...current, photo_path } });
      setSaving(false);
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? "No se pudo guardar la foto.");
    }
  }

  // -----------------------
  // Submit
  // -----------------------
  async function submitRun() {
    if (!run) return;

    // Validación: si exige comentario/foto y está en FAIL, bloquea
    for (const q of questions) {
      const a = answersByQ[q.id];
      if (!a) continue;

      if (a.answer === "FAIL") {
        if (q.require_comment && !(a.comment ?? "").trim()) {
          setError(`Falta comentario en: "${q.text}"`);
          return;
        }
        if (q.require_photo && !(a.photo_path ?? "").trim()) {
          setError(`Falta foto en: "${q.text}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const score = totals.score === null ? null : clamp(totals.score, 0, 100);

      const { error: upErr } = await supabase
        .from("audit_runs")
        .update({
          status: "submitted",
          score,
        })
        .eq("id", run.id);

      if (upErr) throw upErr;

      setRun({ ...run, status: "submitted", score });

      router.push(`/audits/${run.id}/view`);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo enviar la auditoría.");
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------
  // UI
  // -----------------------
  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    padding: 18,
  };

  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    height: 42,
  };

  const btnGhost: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  const pill: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(0,0,0,0.06)",
    fontWeight: 950,
    fontSize: 12,
  };

  if (loading)
    return (
      <main style={{ padding: 24 }}>
        <p>Cargando…</p>
      </main>
    );

  if (error && !run) {
    return (
      <main style={{ padding: 24 }}>
        <BackButton fallback="/areas" />
        <p style={{ color: "crimson", fontWeight: 900 }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <BackButton fallback="/areas" />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ fontSize: 56, marginBottom: 6 }}>Auditoría</h1>

          <div style={{ opacity: 0.85, fontWeight: 900 }}>
            {template?.name ?? "—"} · {area?.name ?? "—"} {area?.type ? `· ${area.type}` : ""}
          </div>

          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
            ID: {run?.id ?? "—"} · Fecha: {fmtDate(run?.executed_at ?? null)}
          </div>

          {error ? <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>{error}</div> : null}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ ...card, padding: 14, minWidth: 220 }}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Progreso</div>
            <div style={{ fontWeight: 900, opacity: 0.9 }}>
              {Object.keys(answersByQ).length}/{totals.total} · FAIL {totals.fail} · NA {totals.na}
            </div>
            <div style={{ marginTop: 8, fontWeight: 950, color: scoreColor(totals.score) }}>
              Score: {totals.score === null ? "—" : `${totals.score.toFixed(2)}%`}
            </div>
          </div>

          <button onClick={submitRun} disabled={submitting} style={{ ...btn, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>

      {/* LISTADO por secciones */}
      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        {sections.map((s) => {
          const qs = grouped[s.id] ?? [];
          if (qs.length === 0) return null;

          return (
            <div key={s.id} style={card}>
              <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 10 }}>{s.name}</div>

              <div style={{ display: "grid", gap: 12 }}>
                {qs.map((q) => {
                  const a = answersByQ[q.id];
                  const selected = a?.answer ?? null; // null => PASS implícito (sin fila)

                  const isFail = selected === "FAIL";
                  const isNA = selected === "NA";

                  return (
                    <div
                      key={q.id}
                      style={{
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "#fff",
                        padding: 14,
                      }}
                    >
                      <div style={{ fontWeight: 950, marginBottom: 10 }}>{q.text}</div>

                      {/* SOLO FAIL / NA */}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          onClick={() => setAnswer(q.id, isFail ? null : "FAIL")}
                          disabled={saving}
                          style={{
                            ...btnGhost,
                            background: isFail ? "#000" : "#fff",
                            color: isFail ? "#fff" : "#000",
                            fontWeight: 950,
                          }}
                        >
                          FAIL
                        </button>

                        <button
                          onClick={() => setAnswer(q.id, isNA ? null : "NA")}
                          disabled={saving}
                          style={{
                            ...btnGhost,
                            background: isNA ? "#000" : "#fff",
                            color: isNA ? "#fff" : "#000",
                            fontWeight: 950,
                          }}
                        >
                          NA
                        </button>

                        {/* Indicadores de reglas */}
                        {q.require_comment ? <span style={pill}>Comentario</span> : null}
                        {q.require_photo ? <span style={pill}>Foto</span> : null}
                      </div>

                      {/* Detalle: solo si existe excepción */}
                      {a ? (
                        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>
                              Comentario{q.require_comment && isFail ? " (obligatorio en FAIL)" : ""}
                            </div>
                            <textarea
                              value={a.comment ?? ""}
                              onChange={(e) => setComment(q.id, e.target.value)}
                              placeholder="Escribe comentario…"
                              style={{
                                width: "100%",
                                minHeight: 70,
                                padding: 12,
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.18)",
                                outline: "none",
                                fontWeight: 700,
                              }}
                            />
                          </div>

                          <div>
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>
                              Foto (ruta){q.require_photo && isFail ? " (obligatoria en FAIL)" : ""}
                            </div>
                            <input
                              value={a.photo_path ?? ""}
                              onChange={(e) => setPhotoPath(q.id, e.target.value || null)}
                              placeholder='Ej: "bucket/path.jpg" o URL'
                              style={{
                                width: "100%",
                                padding: 12,
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.18)",
                                outline: "none",
                                fontWeight: 700,
                              }}
                            />
                            <div style={{ marginTop: 6, opacity: 0.65, fontSize: 12 }}>
                              (De momento guardamos una ruta/URL. Luego metemos subida real a Storage.)
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {questions.length === 0 ? <div style={card}>No hay preguntas activas en esta auditoría.</div> : null}
      </div>
    </main>
  );
}
