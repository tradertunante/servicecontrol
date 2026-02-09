// app/builder/[templateId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/app/components/BackButton";

type TemplateRow = {
  id: string;
  name: string;
  active: boolean | null;
  area_id: string | null;
  created_at: string | null;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
};

type SectionRow = {
  id: string;
  audit_template_id: string;
  name: string;
  active: boolean | null;
  created_at: string | null;
};

type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  tag: string | null;
  order: number | null;
  active: boolean;
  require_comment: boolean;
  require_photo: boolean;
  require_signature: boolean;
  created_at: string | null;
};

type UiRow = {
  questionId: string;
  sectionId: string;
  classification: string; // section.name
  tag: string;
  standard: string;
  require_comment: boolean;
  require_photo: boolean;
  require_signature: boolean;
  active: boolean;
  order: number; // always numeric in UI
};

function toBool(v: any): boolean {
  return v === true;
}

function safeStr(v: any): string {
  return (v ?? "").toString();
}

function normalizeOrder(n: number | null | undefined, fallback: number) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : fallback;
}

export default function BuilderTemplatePage() {
  const router = useRouter();
  const params = useParams<{ templateId: string }>();
  const templateId = params?.templateId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [rows, setRows] = useState<UiRow[]>([]);

  // Quick rules
  const [quickComment, setQuickComment] = useState(false);
  const [quickPhoto, setQuickPhoto] = useState(false);
  const [quickSignature, setQuickSignature] = useState(false);

  // Rename
  const [nameDraft, setNameDraft] = useState("");

  // -----------------------
  // Load
  // -----------------------
  useEffect(() => {
    if (!templateId) return;

    (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        // Template
        const { data: tData, error: tErr } = await supabase
          .from("audit_templates")
          .select("id,name,active,area_id,created_at")
          .eq("id", templateId)
          .single();

        if (tErr || !tData) throw tErr ?? new Error("No se encontró la auditoría.");
        const tpl = tData as TemplateRow;
        setTemplate(tpl);
        setNameDraft(tpl.name ?? "");

        // Area (si existe)
        if (tpl.area_id) {
          const { data: aData, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type")
            .eq("id", tpl.area_id)
            .single();
          if (!aErr && aData) setArea(aData as AreaRow);
        } else {
          setArea(null);
        }

        // Sections
        const { data: sData, error: sErr } = await supabase
          .from("audit_sections")
          .select("id,audit_template_id,name,active,created_at")
          .eq("audit_template_id", templateId)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (sErr) throw sErr;
        const secs = (sData ?? []) as SectionRow[];
        setSections(secs);

        // Questions for those sections
        const secIds = secs.map((s) => s.id);
        let qList: QuestionRow[] = [];
        if (secIds.length) {
          const { data: qData, error: qErr } = await supabase
            .from("audit_questions")
            .select(
              "id,audit_section_id,text,tag,order,active,require_comment,require_photo,require_signature,created_at"
            )
            .in("audit_section_id", secIds)
            .order("order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true });

          if (qErr) throw qErr;
          qList = (qData ?? []) as QuestionRow[];
        }
        setQuestions(qList);

        // Build UI rows (with stable per-section order fallback)
        const secNameById = new Map<string, string>();
        for (const s of secs) secNameById.set(s.id, s.name ?? "Sin sección");

        const perSectionCounter = new Map<string, number>();
        const ui: UiRow[] = qList.map((q) => {
          const count = (perSectionCounter.get(q.audit_section_id) ?? 0) + 1;
          perSectionCounter.set(q.audit_section_id, count);

          const order = normalizeOrder(q.order, count);

          return {
            questionId: q.id,
            sectionId: q.audit_section_id,
            classification: secNameById.get(q.audit_section_id) ?? "Sin sección",
            tag: safeStr(q.tag),
            standard: safeStr(q.text),
            require_comment: toBool(q.require_comment),
            require_photo: toBool(q.require_photo),
            require_signature: toBool(q.require_signature),
            active: toBool(q.active),
            order,
          };
        });

        // Sort: sections by created_at/id as loaded, then order inside
        const sectionIndex = new Map<string, number>();
        secs.forEach((s, idx) => sectionIndex.set(s.id, idx));

        ui.sort((a, b) => {
          const sa = sectionIndex.get(a.sectionId) ?? 999999;
          const sb = sectionIndex.get(b.sectionId) ?? 999999;
          if (sa !== sb) return sa - sb;
          if (a.order !== b.order) return a.order - b.order;
          return a.questionId.localeCompare(b.questionId);
        });

        setRows(ui);

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando el editor.");
      }
    })();
  }, [templateId]);

  const totalCount = rows.length;

  // -----------------------
  // Helpers: persist row fields
  // -----------------------
  async function updateQuestion(questionId: string, patch: Partial<QuestionRow>) {
    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const { error: upErr } = await supabase.from("audit_questions").update(patch).eq("id", questionId);
      if (upErr) throw upErr;

      // update local rows
      setRows((prev) =>
        prev.map((r) => {
          if (r.questionId !== questionId) return r;

          const next = { ...r };

          if (patch.text !== undefined) next.standard = safeStr(patch.text);
          if (patch.tag !== undefined) next.tag = safeStr(patch.tag);
          if (patch.require_comment !== undefined) next.require_comment = toBool(patch.require_comment);
          if (patch.require_photo !== undefined) next.require_photo = toBool(patch.require_photo);
          if (patch.require_signature !== undefined) next.require_signature = toBool(patch.require_signature);
          if (patch.active !== undefined) next.active = toBool(patch.active);
          if (patch.order !== undefined) next.order = normalizeOrder(patch.order, next.order);

          return next;
        })
      );

      setInfo("Guardado ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------
  // Rename template
  // -----------------------
  async function saveTemplateName() {
    if (!templateId) return;
    const nextName = nameDraft.trim();
    if (!nextName) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const { error: upErr } = await supabase.from("audit_templates").update({ name: nextName }).eq("id", templateId);
      if (upErr) throw upErr;
      setTemplate((t) => (t ? { ...t, name: nextName } : t));
      setInfo("Nombre guardado ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar el nombre.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------
  // Toggle template active
  // -----------------------
  async function toggleTemplateActive() {
    if (!templateId || !template) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const next = !(template.active !== false);
      const { error: upErr } = await supabase.from("audit_templates").update({ active: !next }).eq("id", templateId);
      if (upErr) throw upErr;
      setTemplate({ ...template, active: !next });
      setInfo(!next ? "Activada ✅" : "Desactivada ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cambiar el estado.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------
  // Quick rules apply to ALL questions
  // -----------------------
  async function applyQuickRules(kind: "comment" | "photo" | "signature") {
    const val = kind === "comment" ? quickComment : kind === "photo" ? quickPhoto : quickSignature;
    const ok = confirm(`¿Aplicar "${kind}" = ${val ? "Sí" : "No"} a TODAS las preguntas?`);
    if (!ok) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const patch =
        kind === "comment"
          ? { require_comment: val }
          : kind === "photo"
          ? { require_photo: val }
          : { require_signature: val };

      const ids = rows.map((r) => r.questionId);
      if (ids.length) {
        const { error: upErr } = await supabase.from("audit_questions").update(patch).in("id", ids);
        if (upErr) throw upErr;

        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            ...(kind === "comment" ? { require_comment: val } : {}),
            ...(kind === "photo" ? { require_photo: val } : {}),
            ...(kind === "signature" ? { require_signature: val } : {}),
          }))
        );
      }

      setInfo("Reglas aplicadas ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo aplicar.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------
  // Delete one question
  // -----------------------
  async function deleteQuestion(questionId: string) {
    const ok = confirm("¿Borrar esta pregunta?");
    if (!ok) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const { error: delErr } = await supabase.from("audit_questions").delete().eq("id", questionId);
      if (delErr) throw delErr;

      setRows((prev) => prev.filter((r) => r.questionId !== questionId));
      setInfo("Borrada ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo borrar.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------
  // Delete all (sections + questions)
  // -----------------------
  async function deleteAllFromTemplate() {
    if (!templateId) return;

    const ok = confirm("¿Seguro? Esto borrará TODAS las preguntas y secciones de esta auditoría.");
    if (!ok) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const { data: secs, error: sErr } = await supabase
        .from("audit_sections")
        .select("id")
        .eq("audit_template_id", templateId);

      if (sErr) throw sErr;

      const sectionIds = (secs ?? []).map((s: any) => s.id);
      if (sectionIds.length > 0) {
        const { error: qDelErr } = await supabase.from("audit_questions").delete().in("audit_section_id", sectionIds);
        if (qDelErr) throw qDelErr;
      }

      const { error: sDelErr } = await supabase.from("audit_sections").delete().eq("audit_template_id", templateId);
      if (sDelErr) throw sDelErr;

      setRows([]);
      setSections([]);
      setQuestions([]);
      setInfo("Borrado completo ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo borrar.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------
  // Reorder (↑ / ↓) within same section
  // -----------------------
  const sectionIndex = useMemo(() => {
    const map = new Map<string, number>();
    sections.forEach((s, idx) => map.set(s.id, idx));
    return map;
  }, [sections]);

  function sortRows(list: UiRow[]) {
    const next = [...list];
    next.sort((a, b) => {
      const sa = sectionIndex.get(a.sectionId) ?? 999999;
      const sb = sectionIndex.get(b.sectionId) ?? 999999;
      if (sa !== sb) return sa - sb;
      if (a.order !== b.order) return a.order - b.order;
      return a.questionId.localeCompare(b.questionId);
    });
    return next;
  }

  async function move(questionId: string, dir: "up" | "down") {
    const current = rows.find((r) => r.questionId === questionId);
    if (!current) return;

    const sameSection = rows
      .filter((r) => r.sectionId === current.sectionId)
      .sort((a, b) => a.order - b.order || a.questionId.localeCompare(b.questionId));

    const idx = sameSection.findIndex((r) => r.questionId === questionId);
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= sameSection.length) return;

    const target = sameSection[targetIdx];

    // Swap orders
    const aOrder = current.order;
    const bOrder = target.order;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const { error: e1 } = await supabase.from("audit_questions").update({ order: bOrder }).eq("id", current.questionId);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("audit_questions").update({ order: aOrder }).eq("id", target.questionId);
      if (e2) throw e2;

      // Update local state
      setRows((prev) => {
        const swapped = prev.map((r) => {
          if (r.questionId === current.questionId) return { ...r, order: bOrder };
          if (r.questionId === target.questionId) return { ...r, order: aOrder };
          return r;
        });
        return sortRows(swapped);
      });

      setInfo("Orden actualizado ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo mover.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------
  // UI
  // -----------------------
  const card: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
  };

  const btnBlack: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  const btnWhite: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
  };

  const smallBtn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 38,
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p>Cargando…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <BackButton fallback="/builder" />
          <h1 style={{ fontSize: 56, margin: "10px 0 6px" }}>Editor de auditoría</h1>
          <div style={{ opacity: 0.85, fontWeight: 900 }}>
            Rol: <span style={{ fontWeight: 950 }}>admin</span> · ID: {template?.id}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/builder")} style={btnWhite}>
            Volver
          </button>

          <button
            onClick={() => router.push(`/builder/${templateId}/import`)}
            style={btnWhite}
          >
            Importar Excel
          </button>

          <button onClick={toggleTemplateActive} style={btnBlack} disabled={saving}>
            {template?.active === false ? "Activar" : "Desactivar"}
          </button>
        </div>
      </div>

      {error ? <div style={{ marginTop: 12, color: "crimson", fontWeight: 950 }}>{error}</div> : null}
      {info ? <div style={{ marginTop: 12, color: "green", fontWeight: 950 }}>{info}</div> : null}

      {/* Datos auditoría */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Datos de la auditoría</div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 420, flex: 1 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Nombre</div>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.18)",
                outline: "none",
                fontWeight: 900,
                fontSize: 16,
              }}
            />
          </div>

          <button onClick={saveTemplateName} style={{ ...btnBlack, marginTop: 24 }} disabled={saving}>
            Guardar nombre
          </button>
        </div>

        <div style={{ marginTop: 12, opacity: 0.85, fontWeight: 900 }}>
          Área: {area?.name ?? "—"} {area?.type ? `· ${area.type}` : ""}{" "}
          <span style={{ marginLeft: 10, padding: "6px 10px", borderRadius: 999, background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.12)", fontWeight: 950 }}>
            {template?.active === false ? "INACTIVA" : "ACTIVA"}
          </span>
        </div>

        <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
          Creada: {template?.created_at ? new Date(template.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "2-digit" }) : "—"}
        </div>
      </div>

      {/* Reglas rápidas */}
      <div style={{ ...card, marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 950, marginBottom: 4 }}>Reglas rápidas</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Aplica checkboxes a TODAS las preguntas de esta auditoría.</div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
            <input type="checkbox" checked={quickComment} onChange={(e) => setQuickComment(e.target.checked)} />
            Exigir comentario
          </label>
          <button style={smallBtn} onClick={() => applyQuickRules("comment")} disabled={saving}>
            Aplicar
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
            <input type="checkbox" checked={quickPhoto} onChange={(e) => setQuickPhoto(e.target.checked)} />
            Exigir foto
          </label>
          <button style={smallBtn} onClick={() => applyQuickRules("photo")} disabled={saving}>
            Aplicar
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
            <input type="checkbox" checked={quickSignature} onChange={(e) => setQuickSignature(e.target.checked)} />
            Exigir firma
          </label>
          <button style={smallBtn} onClick={() => applyQuickRules("signature")} disabled={saving}>
            Aplicar
          </button>

          <div style={{ fontWeight: 900, opacity: 0.9, marginLeft: 10 }}>Total: {totalCount}</div>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Preguntas (tabla)</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              STANDARD — TAG — CLASSIFICATION — Comentario — Foto — Firma
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.06)", fontWeight: 900 }}>
              Edición inline (se guarda al salir)
            </span>

            <button onClick={deleteAllFromTemplate} style={{ ...btnWhite, borderColor: "rgba(200,0,0,0.35)" }} disabled={saving}>
              Borrar todas
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            {/* 👇 esto fuerza que STANDARD sea MUCHO más ancho SIEMPRE */}
            <colgroup>
              <col style={{ width: 90 }} />   {/* Orden */}
              <col style={{ width: 260 }} />  {/* Classification */}
              <col style={{ width: 240 }} />  {/* Tag */}
              <col style={{ width: 760 }} />  {/* Standard (ancho) */}
              <col style={{ width: 110 }} />  {/* Comentario */}
              <col style={{ width: 80 }} />   {/* Foto */}
              <col style={{ width: 80 }} />   {/* Firma */}
              <col style={{ width: 80 }} />   {/* Activa */}
              <col style={{ width: 90 }} />   {/* Borrar */}
            </colgroup>

            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>ORD</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>CLASSIFICATION</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>TAG</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>STANDARD</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Comentario</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Foto</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Firma</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Activa</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>Borrar</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => {
                // compute up/down disabled within section
                const sameSection = rows.filter((x) => x.sectionId === r.sectionId).sort((a, b) => a.order - b.order || a.questionId.localeCompare(b.questionId));
                const pos = sameSection.findIndex((x) => x.questionId === r.questionId);
                const canUp = pos > 0;
                const canDown = pos !== -1 && pos < sameSection.length - 1;

                return (
                  <tr key={r.questionId} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    {/* Orden controls */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          title="Subir"
                          onClick={() => move(r.questionId, "up")}
                          disabled={saving || !canUp}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.2)",
                            background: "#fff",
                            cursor: saving || !canUp ? "not-allowed" : "pointer",
                            opacity: saving || !canUp ? 0.5 : 1,
                            fontWeight: 950,
                          }}
                        >
                          ↑
                        </button>

                        <button
                          title="Bajar"
                          onClick={() => move(r.questionId, "down")}
                          disabled={saving || !canDown}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.2)",
                            background: "#fff",
                            cursor: saving || !canDown ? "not-allowed" : "pointer",
                            opacity: saving || !canDown ? 0.5 : 1,
                            fontWeight: 950,
                          }}
                        >
                          ↓
                        </button>
                      </div>
                      <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12, fontWeight: 900 }}>
                        {r.order}
                      </div>
                    </td>

                    {/* CLASSIFICATION */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top", fontWeight: 950 }}>
                      {r.classification}
                    </td>

                    {/* TAG */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input
                        value={r.tag}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.questionId === r.questionId ? { ...x, tag: e.target.value } : x))
                          )
                        }
                        onBlur={() => updateQuestion(r.questionId, { tag: r.tag.trim() || null })}
                        placeholder="Ej: Service"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: "1px solid rgba(0,0,0,0.18)",
                          outline: "none",
                          fontWeight: 900,
                          background: "#fff",
                        }}
                      />
                    </td>

                    {/* STANDARD (wide) */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <textarea
                        value={r.standard}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.questionId === r.questionId ? { ...x, standard: e.target.value } : x))
                          )
                        }
                        onBlur={() => updateQuestion(r.questionId, { text: r.standard.trim() })}
                        style={{
                          width: "100%",
                          minHeight: 64,
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: "1px solid rgba(0,0,0,0.18)",
                          outline: "none",
                          fontWeight: 900,
                          resize: "vertical",
                          background: "#fff",
                        }}
                      />
                    </td>

                    {/* Comentario */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={r.require_comment}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setRows((prev) =>
                            prev.map((x) => (x.questionId === r.questionId ? { ...x, require_comment: v } : x))
                          );
                          updateQuestion(r.questionId, { require_comment: v });
                        }}
                      />
                    </td>

                    {/* Foto */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={r.require_photo}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setRows((prev) =>
                            prev.map((x) => (x.questionId === r.questionId ? { ...x, require_photo: v } : x))
                          );
                          updateQuestion(r.questionId, { require_photo: v });
                        }}
                      />
                    </td>

                    {/* Firma */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={r.require_signature}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setRows((prev) =>
                            prev.map((x) => (x.questionId === r.questionId ? { ...x, require_signature: v } : x))
                          );
                          updateQuestion(r.questionId, { require_signature: v });
                        }}
                      />
                    </td>

                    {/* Activa */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setRows((prev) => prev.map((x) => (x.questionId === r.questionId ? { ...x, active: v } : x)));
                          updateQuestion(r.questionId, { active: v });
                        }}
                      />
                    </td>

                    {/* Borrar */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}>
                      <button
                        onClick={() => deleteQuestion(r.questionId)}
                        disabled={saving}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.2)",
                          background: "#fff",
                          cursor: saving ? "not-allowed" : "pointer",
                          opacity: saving ? 0.6 : 1,
                          fontWeight: 950,
                        }}
                        title="Borrar"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 14, opacity: 0.8 }}>
                    No hay preguntas. Importa desde Excel o crea preguntas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, opacity: 0.75, fontSize: 13 }}>
          Nota: el orden (↑/↓) reordena dentro de la misma <strong>CLASSIFICATION</strong> (sección).
        </div>
      </div>
    </main>
  );
}
