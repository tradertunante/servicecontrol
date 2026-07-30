// FILE: app/superadmin/templates/[templateId]/page.tsx
"use client";

/**
 * NOTA:
 * En tu pegado original, aquí recortaste la tabla con "...".
 * Este archivo compila y carga; pero para que “aparezcan las preguntas / builder completo”
 * necesito que pegues el bloque de tu tabla (UI) si quieres que lo deje 100% idéntico al tuyo.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  category: string | null;
  language: string;
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
  certificationIds: string[];
  comment_requirement: RequirementType;
  photo_requirement: RequirementType;
  signature_requirement: RequirementType;
  active: boolean;
  order: number;
};

type CertificationStandardRow = {
  id: string;
  hotel_id: string | null;
  name: string;
  active: boolean;
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

  const [rows, setRows] = useState<UiRow[]>([]);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);

  const [certifications, setCertifications] = useState<CertificationStandardRow[]>([]);
  const [certificationsAvailable, setCertificationsAvailable] = useState(true);

  const [quickComment, setQuickComment] = useState<RequirementType>("never");
  const [quickPhoto, setQuickPhoto] = useState<RequirementType>("never");
  const [quickSignature, setQuickSignature] = useState<RequirementType>("never");

  const [nameDraft, setNameDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("es");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function duplicateTemplate() {
    if (!templateId) return;
    setSaving(true); setError(null); setInfo(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch(`/api/superadmin/templates/${templateId}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo duplicar.");
      router.push(`/superadmin/templates/${payload.template_id}`);
    } catch (e: any) {
      setError(e?.message ?? "Error al duplicar.");
    } finally {
      setSaving(false); setMenuOpen(false);
    }
  }

  async function deleteTemplate() {
    if (!templateId || !template) return;
    if (!window.confirm(`¿Eliminar "${template.name}"? Borrará todas sus secciones y preguntas. No se puede deshacer.`)) return;
    setSaving(true); setError(null); setInfo(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch(`/api/superadmin/templates/${templateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo eliminar.");
      router.push("/superadmin/global-audits");
    } catch (e: any) {
      setError(e?.message ?? "Error al eliminar.");
    } finally {
      setSaving(false); setMenuOpen(false);
    }
  }

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
          supabase.from("audit_templates").select("id,name,active,area_id,created_at,scope,category,language").eq("id", templateId).single(),
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
        setCategoryDraft(tpl.category ?? "");
        setLanguageDraft(tpl.language ?? "es");
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

        // Certificados disponibles según el/los PACK(S) a los que pertenece
        // esta plantilla global (Forbes / LHW / Meliá, etc.), no el catálogo
        // completo — una plantilla que no está en ningún pack no tiene
        // certificados para elegir. Defensivo: si la migración aún no está
        // desplegada en este entorno, se oculta la funcionalidad en vez de
        // romper el editor.
        const questionIds = qList.map((q) => q.id);
        const certByQuestion = new Map<string, string[]>();
        try {
          const { data: packLinks, error: packLinksErr } = await supabase
            .from("global_audit_pack_templates")
            .select("pack_id")
            .eq("audit_template_id", templateId);
          if (packLinksErr) throw packLinksErr;

          const packIds = Array.from(new Set((packLinks ?? []).map((l) => l.pack_id)));

          let certData: CertificationStandardRow[] = [];
          if (packIds.length) {
            const { data: packCertLinks, error: packCertErr } = await supabase
              .from("global_audit_pack_certifications")
              .select("certification_standard_id")
              .in("pack_id", packIds);
            if (packCertErr) throw packCertErr;

            const certIds = Array.from(
              new Set((packCertLinks ?? []).map((l) => l.certification_standard_id))
            );

            if (certIds.length) {
              const { data: certRows, error: certErr } = await supabase
                .from("certification_standards")
                .select("id,hotel_id,name,active")
                .in("id", certIds)
                .eq("active", true)
                .order("name", { ascending: true });
              if (certErr) throw certErr;
              certData = (certRows ?? []) as CertificationStandardRow[];
            }
          }
          if (mounted) setCertifications(certData);

          if (questionIds.length) {
            const { data: linkData, error: linkErr } = await supabase
              .from("audit_question_certifications")
              .select("question_id,certification_standard_id")
              .in("question_id", questionIds);
            if (linkErr) throw linkErr;
            for (const link of linkData ?? []) {
              const list = certByQuestion.get(link.question_id) ?? [];
              list.push(link.certification_standard_id);
              certByQuestion.set(link.question_id, list);
            }
          }
          if (mounted) setCertificationsAvailable(true);
        } catch {
          if (mounted) {
            setCertifications([]);
            setCertificationsAvailable(false);
          }
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
            certificationIds: certByQuestion.get(q.id) ?? [],
            comment_requirement: toRequirement(q.comment_requirement),
            photo_requirement: toRequirement(q.photo_requirement),
            signature_requirement: toRequirement(q.signature_requirement),
            active: toBool(q.active),
            order,
          };
        });

        ui.sort((a, b) => a.order !== b.order ? a.order - b.order : a.questionId.localeCompare(b.questionId));

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

      setRows((prev) => {
        const updated = prev.map((r) => {
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
        });
        if (patch.order !== undefined) {
          updated.sort((a, b) => a.order !== b.order ? a.order - b.order : a.questionId.localeCompare(b.questionId));
        }
        return updated;
      });

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

  async function saveTemplateMeta() {
    if (!templateId) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await fetchJsonOrThrow(`/api/superadmin/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({
          category: categoryDraft.trim() || null,
          language: languageDraft || "es",
        }),
      });
      setTemplate((t) => t ? { ...t, category: categoryDraft.trim() || null, language: languageDraft || "es" } : t);
      setInfo("Metadatos guardados ✅");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar.");
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

  async function deleteQuestion(questionId: string) {
    setOpenRowMenuId(null);
    if (!templateId) return;
    if (!window.confirm("¿Eliminar esta pregunta? No se puede deshacer.")) return;
    setSaving(true); setError(null); setInfo(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch(`/api/superadmin/templates/${templateId}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question_ids: [questionId] }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se pudo eliminar.");
      setRows((prev) => prev.filter((r) => r.questionId !== questionId));
      setInfo("Pregunta eliminada ✅");
    } catch (e: any) {
      setError(e?.message ?? "Error al eliminar.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Certificados globales (Forbes / LHW / Meliá, etc.) ───────────────────

  async function toggleCertification(questionId: string, certificationId: string, checked: boolean) {
    setRows((prev) =>
      prev.map((x) => {
        if (x.questionId !== questionId) return x;
        const set = new Set(x.certificationIds);
        if (checked) set.add(certificationId);
        else set.delete(certificationId);
        return { ...x, certificationIds: Array.from(set) };
      })
    );
    setSaving(true);
    setError(null);
    try {
      if (checked) {
        const { error: insErr } = await supabase
          .from("audit_question_certifications")
          .insert({ question_id: questionId, certification_standard_id: certificationId });
        if (insErr) throw insErr;
      } else {
        const { error: delErr } = await supabase
          .from("audit_question_certifications")
          .delete()
          .eq("question_id", questionId)
          .eq("certification_standard_id", certificationId);
        if (delErr) throw delErr;
      }
    } catch (e: any) {
      setRows((prev) =>
        prev.map((x) => {
          if (x.questionId !== questionId) return x;
          const set = new Set(x.certificationIds);
          if (checked) set.delete(certificationId);
          else set.add(certificationId);
          return { ...x, certificationIds: Array.from(set) };
        })
      );
      setError(e?.message ?? "No se pudo actualizar el certificado.");
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
          <button onClick={() => router.push("/superadmin/global-audits")} style={btnWhite}>
            ← Atrás
          </button>

          <h1 style={{ fontSize: 56, margin: "10px 0 6px" }}>Builder (Global)</h1>
          <div style={{ opacity: 0.85, fontWeight: 900 }}>
            ID: {template?.id} · <span style={{ fontWeight: 950 }}>scope=global</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => router.push(`/superadmin/templates/${templateId}/import`)} style={btnWhite}>
            Importar catálogo
          </button>

          <button onClick={toggleTemplateActive} style={btnBlack} disabled={saving}>
            {template?.active === false ? "Activar" : "Desactivar"}
          </button>

          {/* three-dot menu */}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              disabled={saving}
              style={{
                ...btnWhite,
                width: 42,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                letterSpacing: 1,
              }}
              title="Más opciones"
            >
              ⋯
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 14,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: 160,
                  overflow: "hidden",
                  zIndex: 100,
                }}
              >
                <button
                  onClick={duplicateTemplate}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 16px",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    fontWeight: 900,
                    fontSize: 14,
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(0,0,0,0.07)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Duplicar plantilla
                </button>
                <button
                  onClick={deleteTemplate}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 16px",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    fontWeight: 900,
                    fontSize: 14,
                    cursor: "pointer",
                    color: "#b91c1c",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Eliminar plantilla
                </button>
              </div>
            )}
          </div>
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

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Categoría</div>
            <input
              value={categoryDraft}
              onChange={(e) => setCategoryDraft(e.target.value)}
              placeholder="Ej: Housekeeping, F&B, Front Office…"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                outline: "none",
                fontWeight: 900,
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ minWidth: 160 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Idioma</div>
            <select
              value={languageDraft}
              onChange={(e) => setLanguageDraft(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                outline: "none",
                fontWeight: 900,
                fontSize: 14,
                height: 42,
              }}
            >
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇬🇧 English</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="it">🇮🇹 Italiano</option>
              <option value="pt">🇵🇹 Português</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="ar">🇸🇦 العربية</option>
            </select>
          </div>

          <button onClick={saveTemplateMeta} style={{ ...btnBlack, marginTop: 24 }} disabled={saving}>
            Guardar metadatos
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

      {certificationsAvailable ? (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontWeight: 950, marginBottom: 4 }}>Certificados / Estándares (globales)</div>
          <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10 }}>
            Marca en cada pregunta a qué certificado(s) aplica (Forbes, LHW, Meliá, etc.). Con una sola
            auditoría se calculará el resultado de cumplimiento de forma independiente para cada certificado.
            Los certificados disponibles son los asignados al pack de esta plantilla en{" "}
            <Link href="/superadmin/global-audits" style={{ fontWeight: 950, textDecoration: "underline" }}>
              /superadmin/global-audits
            </Link>
            .
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {certifications.map((cert) => (
              <div
                key={cert.id}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "rgba(0,0,0,0.03)",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {cert.name}
              </div>
            ))}
            {certifications.length === 0 ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Esta plantilla no tiene certificados disponibles: no está en ningún pack con
                certificados asignados. Gestiónalo desde{" "}
                <Link href="/superadmin/global-audits" style={{ fontWeight: 900, textDecoration: "underline" }}>
                  /superadmin/global-audits
                </Link>
                .
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* overlay to close row menus */}
      {openRowMenuId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpenRowMenuId(null)} />
      )}

      {rows.length === 0 ? (
        <div style={{ ...card, marginTop: 14, opacity: 0.7, fontWeight: 900 }}>
          Esta plantilla no tiene preguntas aún. Usa &quot;Importar catálogo&quot; para añadirlas.
        </div>
      ) : (
        <div style={{ ...card, marginTop: 14, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <th style={{ padding: "9px 10px", textAlign: "left", fontWeight: 950, width: 56 }}>#</th>
                  <th style={{ padding: "9px 10px", textAlign: "left", fontWeight: 950, width: 110 }}>Clasificación</th>
                  <th style={{ padding: "9px 10px", textAlign: "left", fontWeight: 950, width: 80 }}>Tag</th>
                  <th style={{ padding: "9px 10px", textAlign: "left", fontWeight: 950 }}>Estándar</th>
                  {certifications.map((cert) => (
                    <th key={cert.id} style={{ padding: "9px 10px", textAlign: "center", fontWeight: 950, width: 70 }} title={cert.name}>
                      {cert.name}
                    </th>
                  ))}
                  <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 950, width: 110 }}>Comentario</th>
                  <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 950, width: 90 }}>Foto</th>
                  <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 950, width: 90 }}>Firma</th>
                  <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 950, width: 60 }}>Activa</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.questionId}
                    style={{
                      borderBottom: "1px solid rgba(0,0,0,0.05)",
                      background: row.active ? "transparent" : "rgba(0,0,0,0.025)",
                      opacity: row.active ? 1 : 0.55,
                    }}
                  >
                    <td style={{ padding: "6px 10px" }}>
                      <input
                        type="number"
                        defaultValue={row.order}
                        key={`${row.questionId}-${row.order}`}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val !== row.order) updateQuestion(row.questionId, { order: val });
                        }}
                        style={{ width: 46, padding: "4px 6px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontWeight: 900, fontSize: 12, textAlign: "center" }}
                      />
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.06)", fontWeight: 900, fontSize: 11, whiteSpace: "nowrap" }}>
                        {row.classification}
                      </span>
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <input
                        defaultValue={row.tag}
                        onBlur={(e) => { if (e.target.value !== row.tag) updateQuestion(row.questionId, { tag: e.target.value }); }}
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontWeight: 900, fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <input
                        defaultValue={row.standard}
                        onBlur={(e) => { if (e.target.value !== row.standard) updateQuestion(row.questionId, { text: e.target.value }); }}
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontWeight: 700, fontSize: 13 }}
                      />
                    </td>
                    {certifications.map((cert) => (
                      <td key={cert.id} style={{ padding: "6px 10px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={row.certificationIds.includes(cert.id)}
                          disabled={saving}
                          onChange={(e) => toggleCertification(row.questionId, cert.id, e.target.checked)}
                        />
                      </td>
                    ))}
                    {(["comment_requirement", "photo_requirement", "signature_requirement"] as const).map((field) => (
                      <td key={field} style={{ padding: "6px 10px", textAlign: "center" }}>
                        <select
                          value={row[field]}
                          onChange={(e) => updateQuestion(row.questionId, { [field]: e.target.value as RequirementType })}
                          style={{ padding: "5px 6px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontWeight: 900, fontSize: 12, width: "100%" }}
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
                    <td style={{ padding: "6px 6px", textAlign: "center", position: "relative" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenRowMenuId(openRowMenuId === row.questionId ? null : row.questionId); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 900, fontSize: 16, padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}
                        title="Opciones"
                      >
                        ⋯
                      </button>
                      {openRowMenuId === row.questionId && (
                        <div style={{ position: "absolute", top: "calc(100% + 2px)", right: 0, background: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", minWidth: 150, overflow: "hidden", zIndex: 100 }}>
                          <button
                            style={{ display: "block", width: "100%", padding: "10px 14px", textAlign: "left", background: "none", border: "none", fontWeight: 900, fontSize: 13, cursor: "pointer", color: "#b91c1c" }}
                            onClick={(e) => { e.stopPropagation(); deleteQuestion(row.questionId); }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          >
                            Eliminar pregunta
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
