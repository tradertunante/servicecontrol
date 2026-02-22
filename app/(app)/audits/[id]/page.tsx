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

type RequirementType = "never" | "if_fail" | "always";

type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  weight: number | null;
  photo_requirement: RequirementType;
  comment_requirement: RequirementType;
  signature_requirement: RequirementType;
  active: boolean;
  order: number | null;
  created_at: string | null;
  tag?: string | null;
  classification?: string | null;
};

type AnswerValue = "PASS" | "FAIL" | "NA";

type AnswerRow = {
  id: string;
  audit_run_id: string;
  question_id: string;
  answer: AnswerValue | null;
  result: AnswerValue | null;
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

function toRequirement(v: any): RequirementType {
  if (v === "if_fail" || v === "always") return v;
  return "never";
}

export default function AuditRunPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const runId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [run, setRun] = useState<AuditRunRow | null>(null);
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answersByQ, setAnswersByQ] = useState<Record<string, AnswerRow>>({});

  useEffect(() => {
    if (!runId) return;

    let alive = true;

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

        const { data: rData, error: rErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
          .eq("id", runId)
          .single();

        if (rErr || !rData) throw rErr ?? new Error("Auditoría no encontrada.");
        const r = rData as AuditRunRow;
        if (!alive) return;
        setRun(r);

        const [{ data: tData, error: tErr }, { data: aData, error: aErr }] = await Promise.all([
          supabase.from("audit_templates").select("id,name").eq("id", r.audit_template_id).single(),
          supabase.from("areas").select("id,name,type").eq("id", r.area_id).single(),
        ]);

        if (tErr || !tData) throw tErr ?? new Error("Plantilla no encontrada.");
        if (aErr || !aData) throw aErr ?? new Error("Área no encontrada.");

        if (!alive) return;
        setTemplate(tData as TemplateRow);
        setArea(aData as AreaRow);

        const { data: sData, error: sErr } = await supabase
          .from("audit_sections")
          .select("id,name,active,created_at")
          .eq("audit_template_id", r.audit_template_id)
          .eq("active", true)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (sErr) throw sErr;

        const secs = (sData ?? []) as SectionRow[];
        if (!alive) return;
        setSections(secs);

        const secIds = secs.map((s) => s.id);

        let qListLocal: QuestionRow[] = [];
        if (secIds.length) {
          const { data: qData, error: qErr } = await supabase
            .from("audit_questions")
            .select(
              "id,audit_section_id,text,weight,photo_requirement,comment_requirement,signature_requirement,active,order,created_at,tag,classification"
            )
            .in("audit_section_id", secIds)
            .eq("active", true)
            .order("audit_section_id", { ascending: true })
            .order("order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true });

          if (qErr) throw qErr;

          qListLocal = (qData ?? []).map((q: any) => ({
            ...q,
            photo_requirement: toRequirement(q.photo_requirement),
            comment_requirement: toRequirement(q.comment_requirement),
            signature_requirement: toRequirement(q.signature_requirement),
          })) as QuestionRow[];

          if (!alive) return;
          setQuestions(qListLocal);
        } else {
          if (!alive) return;
          setQuestions([]);
          qListLocal = [];
        }

        const { data: ansData, error: ansErr } = await supabase
          .from("audit_answers")
          .select("id,audit_run_id,question_id,answer,result,comment,photo_path")
          .eq("audit_run_id", runId);

        if (ansErr) throw ansErr;

        const map: Record<string, AnswerRow> = {};
        for (const row of (ansData ?? []) as any[]) {
          if (!row?.question_id) continue;
          map[row.question_id] = {
            id: row.id,
            audit_run_id: row.audit_run_id,
            question_id: row.question_id,
            answer: (row.answer ?? null) as AnswerValue | null,
            result: (row.result ?? null) as AnswerValue | null,
            comment: row.comment ?? null,
            photo_path: row.photo_path ?? null,
          };
        }

        // ✅ Seed: crea faltantes como PASS (para que TODO esté PASS por defecto)
        const toUpsert: any[] = [];
        for (const q of qListLocal) {
          if (!map[q.id]) {
            toUpsert.push({
              audit_run_id: runId,
              question_id: q.id,
              answer: "PASS",
              result: "PASS",
              comment: null,
              photo_path: null,
            });
          } else {
            // Si existe pero viene null, normaliza a PASS
            const cur = map[q.id];
            if (!cur.answer || !cur.result) {
              toUpsert.push({
                audit_run_id: runId,
                question_id: q.id,
                answer: (cur.answer ?? "PASS") as AnswerValue,
                result: (cur.result ?? "PASS") as AnswerValue,
                comment: cur.comment ?? null,
                photo_path: cur.photo_path ?? null,
              });
            }
          }
        }

        if (toUpsert.length) {
          const { data: seeded, error: seedErr } = await supabase
            .from("audit_answers")
            .upsert(toUpsert, { onConflict: "audit_run_id,question_id" })
            .select("id,audit_run_id,question_id,answer,result,comment,photo_path");

          if (seedErr) throw seedErr;

          for (const row of seeded ?? []) {
            map[(row as any).question_id] = row as AnswerRow;
          }
        }

        if (!alive) return;
        setAnswersByQ(map);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setLoading(false);
        setError(e?.message ?? "Error cargando auditoría.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [runId, router]);

  const totals = useMemo(() => {
    const total = questions.length;
    let fail = 0;
    let na = 0;

    for (const q of questions) {
      const a = answersByQ[q.id];
      if (!a) continue;

      const val = ((a.answer ?? a.result) ?? "PASS") as AnswerValue;

      if (val === "FAIL") fail += 1;
      if (val === "NA") na += 1;
    }

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

  async function setAnswer(questionId: string, next: AnswerValue) {
    if (!runId) return;

    setSaving(true);
    setError(null);

    try {
      const current = answersByQ[questionId];

      const payload = {
        audit_run_id: runId,
        question_id: questionId,
        answer: next,
        result: next,
        comment: current?.comment ?? null,
        photo_path: current?.photo_path ?? null,
      };

      const { data, error: upErr } = await supabase
        .from("audit_answers")
        .upsert(payload, { onConflict: "audit_run_id,question_id" })
        .select("id,audit_run_id,question_id,answer,result,comment,photo_path")
        .single();

      if (upErr || !data) throw upErr ?? new Error("No se pudo guardar.");

      setAnswersByQ({ ...answersByQ, [questionId]: data as AnswerRow });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  async function setComment(questionId: string, comment: string) {
    setSaving(true);
    setError(null);

    try {
      const current = answersByQ[questionId];
      if (!current?.id) {
        setSaving(false);
        return;
      }

      const { error: upErr } = await supabase.from("audit_answers").update({ comment }).eq("id", current.id);
      if (upErr) throw upErr;

      setAnswersByQ({ ...answersByQ, [questionId]: { ...current, comment } });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar el comentario.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(questionId: string, file: File) {
    if (!runId) return;

    const current = answersByQ[questionId];
    if (!current?.id) {
      setError("No existe respuesta para esta pregunta (seed falló).");
      return;
    }

    // Regla: solo permitir subir foto si está en FAIL (o si la pregunta es ALWAYS)
    const q = questions.find((x) => x.id === questionId);
    const selected = ((current.answer ?? current.result) ?? "PASS") as AnswerValue;
    const allow =
      q?.photo_requirement === "always" || selected === "FAIL";

    if (!allow) {
      setError("Para subir foto, marca FAIL (o que la foto sea obligatoria).");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const extension = file.name.split(".").pop() || "jpg";
      const fileName = `${runId}_${questionId}_${timestamp}.${extension}`;

      const { error: uploadErr } = await supabase.storage.from("audit-photos").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("audit-photos").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const { error: upErr } = await supabase.from("audit_answers").update({ photo_path: publicUrl }).eq("id", current.id);
      if (upErr) throw upErr;

      setAnswersByQ({ ...answersByQ, [questionId]: { ...current, photo_path: publicUrl } });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(questionId: string) {
    const current = answersByQ[questionId];
    if (!current?.photo_path) return;

    const ok = confirm("¿Eliminar esta foto?");
    if (!ok) return;

    setSaving(true);
    setError(null);

    try {
      const parts = current.photo_path.split("/");
      const fileName = parts[parts.length - 1];

      const { error: delErr } = await supabase.storage.from("audit-photos").remove([fileName]);
      if (delErr) console.warn("Error eliminando de Storage:", delErr);

      const { error: upErr } = await supabase.from("audit_answers").update({ photo_path: null }).eq("id", current.id);
      if (upErr) throw upErr;

      setAnswersByQ({ ...answersByQ, [questionId]: { ...current, photo_path: null } });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo eliminar la foto.");
    } finally {
      setSaving(false);
    }
  }

  async function submitRun() {
    if (!run) return;

    for (const q of questions) {
      const a = answersByQ[q.id];
      if (!a) continue;

      const val = ((a.answer ?? a.result) ?? "PASS") as AnswerValue;

      const shouldCheckComment = q.comment_requirement === "always" || (q.comment_requirement === "if_fail" && val === "FAIL");
      const shouldCheckPhoto = q.photo_requirement === "always" || (q.photo_requirement === "if_fail" && val === "FAIL");

      if (shouldCheckComment && !(a.comment ?? "").trim()) {
        setError(`Falta comentario en: "${q.text}"`);
        return;
      }
      if (shouldCheckPhoto && !(a.photo_path ?? "").trim()) {
        setError(`Falta foto en: "${q.text}"`);
        return;
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

  function shouldShowField(requirement: RequirementType, isFail: boolean): boolean {
    if (requirement === "never") return false;
    if (requirement === "always") return true;
    if (requirement === "if_fail") return isFail;
    return false;
  }

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
                  const selected = (((a?.answer ?? a?.result) ?? "PASS") as AnswerValue);

                  const isPass = selected === "PASS";
                  const isFail = selected === "FAIL";
                  const isNA = selected === "NA";

                  const showComment = shouldShowField(q.comment_requirement, isFail);
                  const showPhoto = shouldShowField(q.photo_requirement, isFail);

                  const requireComment =
                    q.comment_requirement === "always" || (q.comment_requirement === "if_fail" && isFail);
                  const requirePhoto =
                    q.photo_requirement === "always" || (q.photo_requirement === "if_fail" && isFail);

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

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          onClick={() => setAnswer(q.id, "PASS")}
                          disabled={saving}
                          style={{
                            ...btnGhost,
                            background: isPass ? "#000" : "#fff",
                            color: isPass ? "#fff" : "#000",
                            fontWeight: 950,
                          }}
                        >
                          PASS
                        </button>

                        <button
                          onClick={() => setAnswer(q.id, isFail ? "PASS" : "FAIL")}
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
                          onClick={() => setAnswer(q.id, isNA ? "PASS" : "NA")}
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

                        {q.comment_requirement !== "never" && <span style={pill}>Comentario</span>}
                        {q.photo_requirement !== "never" && <span style={pill}>Foto</span>}
                      </div>

                      {a && (showComment || showPhoto) ? (
                        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                          {showComment && (
                            <div>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                                Comentario{requireComment ? " (obligatorio)" : ""}
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
                          )}

                          {showPhoto && (
                            <div>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                                Foto{requirePhoto ? " (obligatoria)" : ""}
                              </div>

                              {a.photo_path ? (
                                <div>
                                  <img
                                    src={a.photo_path}
                                    alt="Foto de evidencia"
                                    style={{
                                      maxWidth: "100%",
                                      maxHeight: 300,
                                      borderRadius: 12,
                                      border: "1px solid rgba(0,0,0,0.12)",
                                      marginBottom: 10,
                                    }}
                                  />
                                  <button
                                    onClick={() => deletePhoto(q.id)}
                                    disabled={saving}
                                    style={{
                                      ...btnGhost,
                                      background: "#fff",
                                      borderColor: "#c62828",
                                      color: "#c62828",
                                    }}
                                  >
                                    Eliminar foto
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    id={`photo-${q.id}`}
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) uploadPhoto(q.id, file);
                                    }}
                                  />
                                  <button
                                    onClick={() => document.getElementById(`photo-${q.id}`)?.click()}
                                    disabled={uploading || saving}
                                    style={{
                                      ...btnGhost,
                                      opacity: uploading || saving ? 0.7 : 1,
                                    }}
                                  >
                                    {uploading ? "Subiendo..." : "📷 Upload"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
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