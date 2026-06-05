// FILE: app/superadmin/templates/[templateId]/page.tsx
"use client";

/**
 * NOTA:
 * En tu pegado original, aquí recortaste la tabla con "...".
 * Este archivo compila y carga; pero para que “aparezcan las preguntas / builder completo”
 * necesito que pegues el bloque de tu tabla (UI) si quieres que lo deje 100% idéntico al tuyo.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HotelHeader from "@/app/components/HotelHeader";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";

type TemplateRow = {
  id: string;
  name: string;
  active: boolean | null;
  area_id: string | null;
  created_at: string | null;
  scope: string | null;
};

type AreaRow = { id: string; name: string; type: string | null };

type SectionRow = {
  id: string;
  audit_template_id: string;
  name: string;
  active: boolean | null;
  created_at: string | null;
};

type RequirementType = "never" | "if_fail" | "always" | "optional";

type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  tag: string | null;
  order: number | null;
  active: boolean;
  comment_requirement: RequirementType;
  photo_requirement: RequirementType;
  signature_requirement: RequirementType;
  created_at: string | null;
};

type UiRow = {
  questionId: string;
  sectionId: string;
  classification: string;
  tag: string;
  standard: string;
  comment_requirement: RequirementType;
  photo_requirement: RequirementType;
  signature_requirement: RequirementType;
  active: boolean;
  order: number;
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
function toRequirement(v: any): RequirementType {
  if (v === "if_fail" || v === "always" || v === "optional") return v;
  return "never";
}

export default function SuperadminGlobalTemplateBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = (params as any)?.templateId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [rows, setRows] = useState<UiRow[]>([]);

  const [quickComment, setQuickComment] = useState<RequirementType>("never");
  const [quickPhoto, setQuickPhoto] = useState<RequirementType>("never");
  const [quickSignature, setQuickSignature] = useState<RequirementType>("never");

  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setError(null);
      setInfo(null);

      if (!templateId) {
        if (mounted) {
          setLoading(false);
          setError("Falta el ID de la plantilla en la URL.");
        }
        return;
      }

      setLoading(true);

      try {
        const [templateRes, sectionsRes] = await Promise.all([
          supabase.from("audit_templates").select("id,name,active,area_id,created_at,scope").eq("id", templateId).single(),
          supabase
            .from("audit_sections")
            .select("id,audit_template_id,name,active,created_at")
            .eq("audit_template_id", templateId)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true }),
        ]);

        if (templateRes.error || !templateRes.data) throw templateRes.error ?? new Error("No se encontró la plantilla.");
        if (sectionsRes.error) throw sectionsRes.error;

        const tpl = templateRes.data as TemplateRow;
        const secs = (sectionsRes.data ?? []) as SectionRow[];

        if ((tpl.scope ?? "") !== "global") {
          throw new Error("Esta plantilla no es GLOBAL. Solo se pueden editar plantillas scope='global' aquí.");
        }

        if (!mounted) return;

        setTemplate(tpl);
        setNameDraft(tpl.name ?? "");
        setSections(secs);

        // Area
        if (tpl.area_id) {
          const { data: aData, error: aErr } = await supabase.from("areas").select("id,name,type").eq("id", tpl.area_id).single();
          if (!mounted) return;
          if (!aErr && aData) setArea(aData as AreaRow);
          else setArea(null);
        } else {
          setArea(null);
        }

        // Questions
        const secIds = secs.map((s) => s.id);
        let qList: QuestionRow[] = [];

        if (secIds.length) {
          const { data: qData, error: qErr } = await supabase
            .from("audit_questions")
            .select("id,audit_section_id,text,tag,order,active,comment_requirement,photo_requirement,signature_requirement,created_at")
            .in("audit_section_id", secIds)
            .order("order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true });

          if (qErr) throw qErr;
          qList = (qData ?? []) as QuestionRow[];
        }

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
            comment_requirement: toRequirement(q.comment_requirement),
            photo_requirement: toRequirement(q.photo_requirement),
            signature_requirement: toRequirement(q.signature_requirement),
            active: toBool(q.active),
            order,
          };
        });

        const sectionIndex = new Map<string, number>();
        secs.forEach((s, idx) => sectionIndex.set(s.id, idx));

        ui.sort((a, b) => {
          const sa = sectionIndex.get(a.sectionId) ?? 999999;
          const sb = sectionIndex.get(b.sectionId) ?? 999999;
          if (sa !== sb) return sa - sb;
          if (a.order !== b.order) return a.order - b.order;
          return a.questionId.localeCompare(b.questionId);
        });

        if (!mounted) return;
        setRows(ui);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Error cargando el editor.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [templateId]);

  const totalCount = rows.length;

  async function updateQuestion(questionId: string, patch: Partial<QuestionRow>) {
    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/templates/${templateId}/questions`, {
        method: "PATCH",
        body: JSON.stringify({
          question_ids: [questionId],
          patch,
        }),
      });

      setRows((prev) =>
        prev.map((r) => {
          if (r.questionId !== questionId) return r;
          const next = { ...r };

          if (patch.text !== undefined) next.standard = safeStr(patch.text);
          if (patch.tag !== undefined) next.tag = safeStr(patch.tag);
          if (patch.comment_requirement !== undefined) next.comment_requirement = toRequirement(patch.comment_requirement);
          if (patch.photo_requirement !== undefined) next.photo_requirement = toRequirement(patch.photo_requirement);
          if (patch.signature_requirement !== undefined) next.signature_requirement = toRequirement(patch.signature_requirement);
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

  async function saveTemplateName() {
    if (!templateId) return;
    const nextName = nameDraft.trim();
    if (!nextName) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      await fetchJsonOrThrow(`/api/superadmin/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      });
      setTemplate((t) => (t ? { ...t, name: nextName } : t));
      setInfo("Nombre guardado ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar el nombre.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplateActive() {
    if (!templateId || !template) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const nextActive = template.active === false;
      await fetchJsonOrThrow(`/api/superadmin/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });

      setTemplate({ ...template, active: nextActive });
      setInfo(nextActive ? "Activada ✅" : "Desactivada ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cambiar el estado.");
    } finally {
      setSaving(false);
    }
  }

  async function applyQuickRules(kind: "comment" | "photo" | "signature") {
    const val = kind === "comment" ? quickComment : kind === "photo" ? quickPhoto : quickSignature;
    const ok = confirm(`¿Aplicar "${kind}" = "${val}" a TODAS las preguntas?`);
    if (!ok) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const patch =
        kind === "comment"
          ? { comment_requirement: val }
          : kind === "photo"
          ? { photo_requirement: val }
          : { signature_requirement: val };

      const ids = rows.map((r) => r.questionId);
      if (ids.length) {
        await fetchJsonOrThrow(`/api/superadmin/templates/${templateId}/questions`, {
          method: "PATCH",
          body: JSON.stringify({
            question_ids: ids,
            patch,
          }),
        });

        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            ...(kind === "comment" ? { comment_requirement: val } : {}),
            ...(kind === "photo" ? { photo_requirement: val } : {}),
            ...(kind === "signature" ? { signature_requirement: val } : {}),
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

  const card: CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    padding: 18,
  };

  const btnBlack: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
    whiteSpace: "nowrap",
  };

  const btnWhite: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 42,
    whiteSpace: "nowrap",
  };

  const smallBtn: CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    height: 38,
    whiteSpace: "nowrap",
  };

  if (loading) {
    return (
      <main style={{ padding: 24, paddingTop: 80 }}>
        <HotelHeader />
        <p style={{ opacity: 0.8 }}>Cargando…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, paddingTop: 80 }}>
      <HotelHeader />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <button onClick={() => router.push("/superadmin/templates")} style={btnWhite}>
            ← Atrás
          </button>

          <h1 style={{ fontSize: 56, margin: "10px 0 6px" }}>Builder (Global)</h1>
          <div style={{ opacity: 0.85, fontWeight: 900 }}>
            ID: {template?.id} · <span style={{ fontWeight: 950 }}>scope=global</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push(`/superadmin/templates/${templateId}/import`)} style={btnWhite}>
            Importar catálogo
          </button>

          <button onClick={toggleTemplateActive} style={btnBlack} disabled={saving}>
            {template?.active === false ? "Activar" : "Desactivar"}
          </button>
        </div>
      </div>

      {error ? <div style={{ marginTop: 12, color: "crimson", fontWeight: 950 }}>{error}</div> : null}
      {info ? <div style={{ marginTop: 12, color: "green", fontWeight: 950 }}>{info}</div> : null}

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Datos de la plantilla</div>

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
          <span
            style={{
              marginLeft: 10,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.12)",
              fontWeight: 950,
            }}
          >
            {template?.active === false ? "INACTIVA" : "ACTIVA"}
          </span>
        </div>
      </div>

      <div
        style={{
          ...card,
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, marginBottom: 4 }}>Reglas rápidas</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Aplica requisitos a TODAS las preguntas de esta plantilla.</div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontWeight: 900 }}>Comentario:</label>
            <select
              value={quickComment}
              onChange={(e) => setQuickComment(e.target.value as RequirementType)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)", fontWeight: 900, outline: "none" }}
            >
              <option value="never">Nunca</option>
              <option value="if_fail">Si es FAIL</option>
              <option value="optional">Opcional</option>
              <option value="always">Siempre</option>
            </select>
            <button style={smallBtn} onClick={() => applyQuickRules("comment")} disabled={saving}>
              Aplicar
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontWeight: 900 }}>Foto:</label>
            <select
              value={quickPhoto}
              onChange={(e) => setQuickPhoto(e.target.value as RequirementType)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)", fontWeight: 900, outline: "none" }}
            >
              <option value="never">Nunca</option>
              <option value="if_fail">Si es FAIL</option>
              <option value="optional">Opcional</option>
              <option value="always">Siempre</option>
            </select>
            <button style={smallBtn} onClick={() => applyQuickRules("photo")} disabled={saving}>
              Aplicar
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontWeight: 900 }}>Firma:</label>
            <select
              value={quickSignature}
              onChange={(e) => setQuickSignature(e.target.value as RequirementType)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)", fontWeight: 900, outline: "none" }}
            >
              <option value="never">Nunca</option>
              <option value="if_fail">Si es FAIL</option>
              <option value="optional">Opcional</option>
              <option value="always">Siempre</option>
            </select>
            <button style={smallBtn} onClick={() => applyQuickRules("signature")} disabled={saving}>
              Aplicar
            </button>
          </div>

          <div style={{ fontWeight: 900, opacity: 0.9, marginLeft: 10 }}>Total: {totalCount}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...card, marginTop: 14, opacity: 0.7, fontWeight: 900 }}>
          Esta plantilla no tiene preguntas aún. Usa &quot;Importar catálogo&quot; para añadirlas.
        </div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 16 }}>
          {sections.map((sec) => {
            const secRows = rows.filter((r) => r.sectionId === sec.id);
            if (secRows.length === 0) return null;
            return (
              <div key={sec.id} style={{ ...card, padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "12px 16px",
                    background: "rgba(0,0,0,0.04)",
                    borderBottom: "1px solid rgba(0,0,0,0.08)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 950, fontSize: 15 }}>{sec.name}</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.08)",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {secRows.length} preguntas
                  </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 950, width: 50 }}>#</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 950, width: 90 }}>Tag</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 950 }}>Estándar</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 950, width: 110 }}>Comentario</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 950, width: 90 }}>Foto</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 950, width: 90 }}>Firma</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 950, width: 70 }}>Activa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secRows.map((row) => (
                        <tr
                          key={row.questionId}
                          style={{
                            borderBottom: "1px solid rgba(0,0,0,0.05)",
                            background: row.active ? "transparent" : "rgba(0,0,0,0.025)",
                            opacity: row.active ? 1 : 0.55,
                          }}
                        >
                          <td style={{ padding: "6px 10px", fontWeight: 900, color: "rgba(0,0,0,0.4)", fontSize: 12 }}>
                            <input
                              type="number"
                              defaultValue={row.order}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val !== row.order) updateQuestion(row.questionId, { order: val });
                              }}
                              style={{
                                width: 46,
                                padding: "4px 6px",
                                borderRadius: 8,
                                border: "1px solid rgba(0,0,0,0.15)",
                                fontWeight: 900,
                                fontSize: 12,
                                textAlign: "center",
                              }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              defaultValue={row.tag}
                              onBlur={(e) => {
                                if (e.target.value !== row.tag) updateQuestion(row.questionId, { tag: e.target.value });
                              }}
                              style={{
                                width: "100%",
                                padding: "5px 8px",
                                borderRadius: 8,
                                border: "1px solid rgba(0,0,0,0.15)",
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              defaultValue={row.standard}
                              onBlur={(e) => {
                                if (e.target.value !== row.standard) updateQuestion(row.questionId, { text: e.target.value });
                              }}
                              style={{
                                width: "100%",
                                padding: "5px 8px",
                                borderRadius: 8,
                                border: "1px solid rgba(0,0,0,0.15)",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            />
                          </td>
                          {(["comment_requirement", "photo_requirement", "signature_requirement"] as const).map((field) => (
                            <td key={field} style={{ padding: "6px 10px", textAlign: "center" }}>
                              <select
                                value={row[field]}
                                onChange={(e) => updateQuestion(row.questionId, { [field]: e.target.value as RequirementType })}
                                style={{
                                  padding: "5px 6px",
                                  borderRadius: 8,
                                  border: "1px solid rgba(0,0,0,0.15)",
                                  fontWeight: 900,
                                  fontSize: 12,
                                  width: "100%",
                                }}
                              >
                                <option value="never">Nunca</option>
                                <option value="if_fail">Si FAIL</option>
                                <option value="optional">Opcional</option>
                                <option value="always">Siempre</option>
                              </select>
                            </td>
                          ))}
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(e) => updateQuestion(row.questionId, { active: e.target.checked })}
                              style={{ width: 16, height: 16, cursor: "pointer" }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
