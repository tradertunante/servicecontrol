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
  team_member_id: string | null; // ✅
};

type TemplateRow = { id: string; name: string };

// ✅ OJO: añadimos hotel_id para filtrar team_members por hotel también
type AreaRow = { id: string; name: string; type: string | null; hotel_id: string | null };

type TeamMemberLite = { id: string; full_name: string; _outOfArea?: boolean }; // ✅

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

  // ✅ Team members (filtrados por área)
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>(""); // "" => auditoría general
  const [savingMember, setSavingMember] = useState(false);

  const submitted = (run?.status ?? "") === "submitted";

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

        // 1) RUN
        const { data: rData, error: rErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id,team_member_id")
          .eq("id", runId)
          .single();

        if (rErr || !rData) throw rErr ?? new Error("Auditoría no encontrada.");

        const r = rData as AuditRunRow;
        if (!alive) return;

        setRun(r);
        setSelectedMember(r.team_member_id ?? "");

        // 2) Template + Área (IMPORTANTE: pedimos hotel_id)
        const [{ data: tData, error: tErr }, { data: aData, error: aErr }] = await Promise.all([
          supabase.from("audit_templates").select("id,name").eq("id", r.audit_template_id).single(),
          supabase.from("areas").select("id,name,type,hotel_id").eq("id", r.area_id).single(),
        ]);

        if (tErr || !tData) throw tErr ?? new Error("Plantilla no encontrada.");
        if (aErr || !aData) throw aErr ?? new Error("Área no encontrada.");

        if (!alive) return;
        setTemplate(tData as TemplateRow);
        setArea(aData as AreaRow);

        // 3) ✅ TEAM MEMBERS filtrados por esta área (team_member_areas)
        //    - primero sacamos IDs en la tabla link
        const { data: linkData, error: linkErr } = await supabase
          .from("team_member_areas")
          .select("team_member_id")
          .eq("area_id", r.area_id);

        if (linkErr) throw linkErr;

        const ids = Array.from(
          new Set((linkData ?? []).map((x: any) => x.team_member_id).filter(Boolean))
        ) as string[];

        let list: TeamMemberLite[] = [];

        if (ids.length) {
          let q = supabase
            .from("team_members")
            .select("id,full_name")
            .eq("active", true)
            .in("id", ids)
            .order("full_name", { ascending: true });

          // si tu team_members tiene hotel_id (en tu caso sí), filtramos por hotel
          const hotelId = (aData as any).hotel_id as string | null;
          if (hotelId) q = q.eq("hotel_id", hotelId);

          const { data: tmData, error: tmErr } = await q;
          if (tmErr) throw tmErr;

          list = (tmData ?? []) as TeamMemberLite[];
        }

        // Si ya había un colaborador guardado fuera de esta área, lo mostramos marcado
        if (r.team_member_id && !list.some((m) => m.id === r.team_member_id)) {
          const { data: one, error: oneErr } = await supabase
            .from("team_members")
            .select("id,full_name")
            .eq("id", r.team_member_id)
            .maybeSingle();

          if (!oneErr && one) {
            list = [{ ...(one as any), _outOfArea: true }, ...list];
          }
        }

        if (!alive) return;
        setTeamMembers(list);

        // 4) Secciones
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

        // 5) Preguntas
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

        // 6) Respuestas
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

        // Seed: crea faltantes como PASS
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

  function shouldShowField(requirement: RequirementType, isFail: boolean): boolean {
    if (requirement === "never") return false;
    if (requirement === "always") return true;
    if (requirement === "if_fail") return isFail;
    return false;
  }

  // ✅ guardar team_member_id en audit_runs
  async function saveTeamMember(nextId: string) {
    if (!run) return;
    if (submitted) return;

    setSavingMember(true);
    setError(null);

    try {
      const value = nextId || null;
      const { error: upErr } = await supabase.from("audit_runs").update({ team_member_id: value }).eq("id", run.id);
      if (upErr) throw upErr;

      setSelectedMember(nextId);
      setRun({ ...run, team_member_id: value });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo asignar el colaborador.");
    } finally {
      setSavingMember(false);
    }
  }

  async function setAnswer(questionId: string, next: AnswerValue) {
    if (!runId) return;
    if (submitted) return;

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
    if (submitted) return;

    setSaving(true);
    setError(null);

    try {
      const current = answersByQ[questionId];
      if (!current?.id) return;

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
    if (submitted) return;

    const current = answersByQ[questionId];
    if (!current?.id) {
      setError("No existe respuesta para esta pregunta (seed falló).");
      return;
    }

    const q = questions.find((x) => x.id === questionId);
    const selected = ((current.answer ?? current.result) ?? "PASS") as AnswerValue;

    const allow = q?.photo_requirement === "always" || selected === "FAIL";
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
    if (submitted) return;

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
    if (submitted) return;

    // Validación de requisitos
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

  if (loading) {
    return (
      <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="w-full px-4 py-4">
          <p className="text-sm text-gray-600">Cargando…</p>
        </div>
      </main>
    );
  }

  if (error && !run) {
    return (
      <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="w-full px-4 py-4">
          <div className="mb-3">
            <BackButton fallback="/areas" />
          </div>
          <p className="text-sm font-semibold text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="w-full px-4 pt-4 pb-24">
        <div className="mb-3">
          <BackButton fallback="/areas" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-extrabold tracking-tight">Auditoría</h1>

          <div className="text-sm font-semibold text-gray-800">
            {template?.name ?? "—"} · {area?.name ?? "—"} {area?.type ? `· ${area.type}` : ""}
          </div>

          <div className="text-xs text-gray-500">Fecha: {fmtDate(run?.executed_at ?? null)}</div>

          {error ? <div className="text-sm font-semibold text-red-600 mt-2">{error}</div> : null}
        </div>

        {/* ✅ Colaborador auditado (FILTRADO por el área) */}
        <div className="mt-4 bg-white rounded-2xl border p-4">
          <div className="text-sm font-extrabold mb-2">Colaborador auditado</div>

          <select
            value={selectedMember}
            disabled={submitted || savingMember}
            onChange={(e) => saveTeamMember(e.target.value)}
            className="w-full border rounded-xl p-2 text-sm font-semibold disabled:opacity-60"
          >
            <option value="">Auditoría general (sin colaborador)</option>

            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
                {m._outOfArea ? " (fuera del área)" : ""}
              </option>
            ))}
          </select>

          {!submitted && teamMembers.length === 0 ? (
            <div className="mt-2 text-xs text-gray-500">
              No hay colaboradores asignados a esta área. Ve a “Equipo” y asígnales áreas.
            </div>
          ) : null}

          {submitted ? <div className="mt-2 text-xs text-gray-500">No se puede cambiar después de enviar.</div> : null}
        </div>

        <div className="mt-4 bg-white rounded-2xl border p-4">
          <div className="text-sm font-extrabold mb-1">Progreso</div>
          <div className="text-sm text-gray-700 font-semibold">
            {Object.keys(answersByQ).length}/{totals.total} · FAIL {totals.fail} · NA {totals.na}
          </div>

          {submitted ? (
            <div className="mt-2 text-sm font-extrabold">
              Score: {run?.score === null ? "—" : `${run.score.toFixed(2)}%`}
            </div>
          ) : (
            <div className="mt-2 text-xs text-gray-500">El resultado se mostrará al enviar la auditoría.</div>
          )}
        </div>

        {/* Secciones */}
        <div className="mt-4 space-y-4">
          {sections.map((s) => {
            const qs = grouped[s.id] ?? [];
            if (qs.length === 0) return null;

            return (
              <section key={s.id} className="bg-white rounded-2xl border p-4">
                <h2 className="text-base font-extrabold mb-3">{s.name}</h2>

                <div className="space-y-3">
                  {qs.map((q) => {
                    const a = answersByQ[q.id];
                    const selected = ((a?.answer ?? a?.result) ?? "PASS") as AnswerValue;

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
                      <div key={q.id} className="rounded-2xl border bg-white p-4">
                        <div className="font-semibold text-sm leading-snug">{q.text}</div>

                        <div className="mt-3 flex gap-3">
                          <button
                            onClick={() => setAnswer(q.id, "PASS")}
                            disabled={saving || submitted}
                            className={[
                              "flex-1 py-2 rounded-xl text-sm font-extrabold border",
                              isPass ? "bg-black text-white border-black" : "bg-white text-black border-gray-300",
                              saving || submitted ? "opacity-60 cursor-not-allowed" : "",
                            ].join(" ")}
                          >
                            PASS
                          </button>

                          <button
                            onClick={() => setAnswer(q.id, isFail ? "PASS" : "FAIL")}
                            disabled={saving || submitted}
                            className={[
                              "flex-1 py-2 rounded-xl text-sm font-extrabold border",
                              isFail ? "bg-black text-white border-black" : "bg-white text-black border-gray-300",
                              saving || submitted ? "opacity-60 cursor-not-allowed" : "",
                            ].join(" ")}
                          >
                            FAIL
                          </button>

                          <button
                            onClick={() => setAnswer(q.id, isNA ? "PASS" : "NA")}
                            disabled={saving || submitted}
                            className={[
                              "flex-1 py-2 rounded-xl text-sm font-extrabold border",
                              isNA ? "bg-black text-white border-black" : "bg-white text-black border-gray-300",
                              saving || submitted ? "opacity-60 cursor-not-allowed" : "",
                            ].join(" ")}
                          >
                            NA
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {q.comment_requirement !== "never" && (
                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gray-100 border">
                              Comentario
                            </span>
                          )}
                          {q.photo_requirement !== "never" && (
                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gray-100 border">
                              Foto
                            </span>
                          )}
                        </div>

                        {a && (showComment || showPhoto) ? (
                          <div className="mt-4 space-y-4">
                            {showComment && (
                              <div>
                                <div className="text-sm font-extrabold mb-2">
                                  Comentario{requireComment ? " (obligatorio)" : ""}
                                </div>
                                <textarea
                                  value={a.comment ?? ""}
                                  onChange={(e) => setComment(q.id, e.target.value)}
                                  placeholder="Escribe comentario…"
                                  disabled={saving || submitted}
                                  className="w-full min-h-[80px] p-3 rounded-xl border font-semibold text-sm outline-none disabled:opacity-60"
                                />
                              </div>
                            )}

                            {showPhoto && (
                              <div>
                                <div className="text-sm font-extrabold mb-2">
                                  Foto{requirePhoto ? " (obligatoria)" : ""}
                                </div>

                                {a.photo_path ? (
                                  <div className="space-y-3">
                                    <img
                                      src={a.photo_path}
                                      alt="Foto de evidencia"
                                      className="w-full max-h-[320px] object-contain rounded-xl border bg-white"
                                    />

                                    <button
                                      onClick={() => deletePhoto(q.id)}
                                      disabled={saving || submitted}
                                      className="w-full py-2 rounded-xl border text-sm font-extrabold text-red-600 border-red-300 disabled:opacity-60"
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
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) uploadPhoto(q.id, file);
                                      }}
                                      disabled={submitted}
                                    />

                                    <button
                                      onClick={() => document.getElementById(`photo-${q.id}`)?.click()}
                                      disabled={uploading || saving || submitted}
                                      className="w-full py-2 rounded-xl border text-sm font-extrabold disabled:opacity-60"
                                    >
                                      {uploading ? "Subiendo..." : "📷 Subir foto"}
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
              </section>
            );
          })}

          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl border p-4 text-sm font-semibold text-gray-700">
              No hay preguntas activas en esta auditoría.
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <button
            onClick={submitRun}
            disabled={submitting || submitted}
            className="w-full py-3 rounded-2xl bg-black text-white font-extrabold text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitted ? "Auditoría enviada" : submitting ? "Enviando…" : "Enviar auditoría"}
          </button>

          {!submitted ? (
            <p className="mt-2 text-xs text-gray-500">El resultado se calculará y mostrará al enviar.</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}