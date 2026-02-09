"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";

type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  weight: number | null;
  require_photo: boolean;
  require_comment: boolean;
  require_signature: boolean;
  active: boolean;
  order: number;
  created_at?: string | null;
};

export default function SectionQuestionsPage() {
  const params = useParams<{ templateId: string; sectionId: string }>();
  const sectionId = params.sectionId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [newText, setNewText] = useState("");

  // -------------------------
  // Load
  // -------------------------
  useEffect(() => {
    if (!sectionId) return;

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("audit_questions")
        .select("*")
        .eq("audit_section_id", sectionId)
        .order("order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (error) setError(error.message);
      setQuestions((data ?? []) as QuestionRow[]);
      setLoading(false);
    })();
  }, [sectionId]);

  // -------------------------
  // Helpers
  // -------------------------
  const nextOrder = useMemo(() => {
    if (questions.length === 0) return 1;
    return Math.max(...questions.map((q) => Number(q.order ?? 0))) + 1;
  }, [questions]);

  async function reload() {
    const { data, error } = await supabase
      .from("audit_questions")
      .select("*")
      .eq("audit_section_id", sectionId)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }
    setQuestions((data ?? []) as QuestionRow[]);
  }

  // -------------------------
  // CRUD
  // -------------------------
  async function createQuestion() {
    const text = newText.trim();
    if (!text) return;

    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from("audit_questions")
      .insert({
        audit_section_id: sectionId,
        text,
        order: nextOrder,
        active: true,
        weight: 1,
        require_photo: false,
        require_comment: false,
        require_signature: false,
      })
      .select("*")
      .single();

    if (error) setError(error.message);
    else {
      setQuestions([...questions, data as QuestionRow].sort((a, b) => a.order - b.order));
      setNewText("");
    }

    setSaving(false);
  }

  async function updateQuestion(id: string, patch: Partial<QuestionRow>) {
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("audit_questions").update(patch).eq("id", id);

    if (error) setError(error.message);
    else {
      setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    }

    setSaving(false);
  }

  async function deleteQuestion(id: string) {
    if (!confirm("¿Eliminar esta pregunta?")) return;

    setSaving(true);
    setError(null);

    const { error } = await supabase.from("audit_questions").delete().eq("id", id);

    if (error) setError(error.message);
    else setQuestions(questions.filter((q) => q.id !== id));

    setSaving(false);
  }

  // -------------------------
  // Apply to all (toggle)
  // -------------------------
  async function applyToAll(
    field: "require_photo" | "require_comment" | "require_signature" | "active",
    value: boolean
  ) {
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("audit_questions")
      .update({ [field]: value } as any)
      .eq("audit_section_id", sectionId);

    if (error) setError(error.message);
    else setQuestions(questions.map((q) => ({ ...q, [field]: value })));

    setSaving(false);
  }

  // -------------------------
  // Reorder (swap order)
  // -------------------------
  async function moveQuestion(id: string, dir: "up" | "down") {
    const idx = questions.findIndex((q) => q.id === id);
    if (idx === -1) return;

    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= questions.length) return;

    const a = questions[idx];
    const b = questions[swapWith];

    setSaving(true);
    setError(null);

    // swap order values
    const { error: e1 } = await supabase.from("audit_questions").update({ order: b.order }).eq("id", a.id);
    if (e1) {
      setSaving(false);
      setError(e1.message);
      return;
    }

    const { error: e2 } = await supabase.from("audit_questions").update({ order: a.order }).eq("id", b.id);
    if (e2) {
      setSaving(false);
      setError(e2.message);
      return;
    }

    await reload();
    setSaving(false);
  }

  // -------------------------
  // UI
  // -------------------------
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
    fontWeight: 900,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.7 : 1,
    height: 42,
  };

  const btnGhost: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.7 : 1,
    height: 42,
  };

  if (loading) return <p style={{ padding: 24 }}>Cargando…</p>;

  return (
    <main style={{ padding: 24 }}>
      <BackButton fallback={`/builder/${params.templateId}`} />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ fontSize: 40, fontWeight: 950, margin: 0 }}>Preguntas</h1>
        <div style={{ opacity: 0.8, fontWeight: 800 }}>{questions.length} preguntas</div>
      </div>

      {error ? <p style={{ color: "crimson", fontWeight: 900 }}>{error}</p> : null}

      {/* Crear */}
      <div style={{ marginTop: 14, ...card }}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Añadir pregunta</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Nueva pregunta…"
            style={{
              flex: 1,
              minWidth: 280,
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.18)",
              fontWeight: 800,
              outline: "none",
            }}
          />
          <button onClick={createQuestion} disabled={saving} style={btn}>
            + Añadir
          </button>
        </div>
      </div>

      {/* Aplicar a todas */}
      <div style={{ marginTop: 14, ...card }}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Aplicar a todas (esta sección)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => applyToAll("require_photo", true)} disabled={saving} style={btnGhost}>
            Foto: ON
          </button>
          <button onClick={() => applyToAll("require_photo", false)} disabled={saving} style={btnGhost}>
            Foto: OFF
          </button>

          <button onClick={() => applyToAll("require_comment", true)} disabled={saving} style={btnGhost}>
            Comentario: ON
          </button>
          <button onClick={() => applyToAll("require_comment", false)} disabled={saving} style={btnGhost}>
            Comentario: OFF
          </button>

          <button onClick={() => applyToAll("require_signature", true)} disabled={saving} style={btnGhost}>
            Firma: ON
          </button>
          <button onClick={() => applyToAll("require_signature", false)} disabled={saving} style={btnGhost}>
            Firma: OFF
          </button>

          <button onClick={() => applyToAll("active", true)} disabled={saving} style={btnGhost}>
            Activar todas
          </button>
          <button onClick={() => applyToAll("active", false)} disabled={saving} style={btnGhost}>
            Desactivar todas
          </button>
        </div>
      </div>

      {/* Lista */}
      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {questions.map((q, idx) => (
          <div key={q.id} style={card}>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Orden: {q.order}</div>
                <input
                  defaultValue={q.text}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== q.text) updateQuestion(q.id, { text: v });
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.16)",
                    fontWeight: 900,
                    outline: "none",
                    marginTop: 6,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => moveQuestion(q.id, "up")} disabled={saving || idx === 0} style={btnGhost}>
                  ↑
                </button>
                <button
                  onClick={() => moveQuestion(q.id, "down")}
                  disabled={saving || idx === questions.length - 1}
                  style={btnGhost}
                >
                  ↓
                </button>
                <button onClick={() => deleteQuestion(q.id)} disabled={saving} style={{ ...btnGhost, borderColor: "rgba(200,0,0,0.35)" }}>
                  Borrar
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
              <label style={{ fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={!!q.active}
                  onChange={(e) => updateQuestion(q.id, { active: e.target.checked })}
                />{" "}
                Activa
              </label>

              <label style={{ fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={!!q.require_photo}
                  onChange={(e) => updateQuestion(q.id, { require_photo: e.target.checked })}
                />{" "}
                Exigir foto
              </label>

              <label style={{ fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={!!q.require_comment}
                  onChange={(e) => updateQuestion(q.id, { require_comment: e.target.checked })}
                />{" "}
                Exigir comentario
              </label>

              <label style={{ fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={!!q.require_signature}
                  onChange={(e) => updateQuestion(q.id, { require_signature: e.target.checked })}
                />{" "}
                Exigir firma
              </label>

              <label style={{ fontWeight: 900, display: "flex", gap: 8, alignItems: "center" }}>
                Peso
                <input
                  type="number"
                  value={q.weight ?? 1}
                  min={0}
                  step={1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setQuestions(questions.map((x) => (x.id === q.id ? { ...x, weight: v } : x)));
                  }}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) updateQuestion(q.id, { weight: v });
                  }}
                  style={{
                    width: 90,
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.16)",
                    fontWeight: 900,
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
        Nota: el orden se guarda en la columna <strong>order</strong> y se mantiene igual que el Excel.
      </div>
    </main>
  );
}
