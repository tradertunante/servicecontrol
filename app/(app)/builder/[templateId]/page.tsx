// app/builder/[templateId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Database } from "@/lib/types/database";
import {
  AreaRow,
  buildResponsibleDepartmentOptions,
  CertificationStandardRow,
  getResponsibleDepartmentValue,
  normalizeOrder,
  QuestionRow,
  RequirementType,
  safeStr,
  SectionRow,
  TemplateRow,
  toBool,
  toRequirement,
  toResponsibleDepartment,
  UiRow,
} from "./_types";
import BuilderHeader from "./_components/BuilderHeader";
import TemplateSettingsCard from "./_components/TemplateSettingsCard";
import CertificationsManagerCard from "./_components/CertificationsManagerCard";
import QuickRulesCard from "./_components/QuickRulesCard";
import QuestionsTable from "./_components/QuestionsTable";

export default function BuilderTemplatePage() {
  const params = useParams<{ templateId: string }>();
  const templateId = params?.templateId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [area, setArea] = useState<AreaRow | null>(null);
  const [hotelAreas, setHotelAreas] = useState<AreaRow[]>([]);
  const [ownerDepartmentAvailable, setOwnerDepartmentAvailable] = useState(true);

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [rows, setRows] = useState<UiRow[]>([]);

  const [hotelId, setHotelId] = useState<string | null>(null);
  const [certifications, setCertifications] = useState<CertificationStandardRow[]>([]);
  const [certificationsAvailable, setCertificationsAvailable] = useState(true);

  // Quick rules
  const [quickComment, setQuickComment] = useState<RequirementType>("never");
  const [quickPhoto, setQuickPhoto] = useState<RequirementType>("never");
  const [quickSignature, setQuickSignature] = useState<RequirementType>("never");

  // Rename
  const [nameDraft, setNameDraft] = useState("");

  const responsibleDepartmentOptions = useMemo(
    () => buildResponsibleDepartmentOptions(hotelAreas),
    [hotelAreas]
  );
  const responsibleDepartmentLabelByValue = useMemo(
    () => new Map(responsibleDepartmentOptions.map((o) => [o.value, o.label])),
    [responsibleDepartmentOptions]
  );

  const templateResponsibleDepartment = useMemo(
    () => getResponsibleDepartmentValue(area),
    [area]
  );
  const templateResponsibleLabel = useMemo(
    () =>
      (templateResponsibleDepartment
        ? responsibleDepartmentLabelByValue.get(templateResponsibleDepartment)
        : null) ?? (area?.name ? safeStr(area.name) : "Área del template"),
    [area, responsibleDepartmentLabelByValue, templateResponsibleDepartment]
  );

  // ─── Initial data load ────────────────────────────────────────────────────

  useEffect(() => {
    if (!templateId) return;

    (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      setOwnerDepartmentAvailable(true);

      try {
        // Template
        let tpl: TemplateRow | null = null;
        {
          const { data: tData, error: tErr } = await supabase
            .from("audit_templates")
            .select(
              "id,name,active,area_id,hotel_id,created_at,require_room_number,require_audited_employee"
            )
            .eq("id", templateId)
            .single();

          if (tErr) {
            const message = String(tErr.message ?? "");
            if (
              message.includes("require_room_number") ||
              message.includes("require_audited_employee")
            ) {
              const { data: fallbackData, error: fallbackErr } = await supabase
                .from("audit_templates")
                .select("id,name,active,area_id,hotel_id,created_at")
                .eq("id", templateId)
                .single();

              if (fallbackErr || !fallbackData)
                throw fallbackErr ?? new Error("No se encontró la auditoría.");
              tpl = {
                ...(fallbackData as Omit<
                  TemplateRow,
                  "require_room_number" | "require_audited_employee"
                >),
                require_room_number: false,
                require_audited_employee: false,
              };
            } else {
              throw tErr;
            }
          } else if (tData) {
            tpl = {
              ...(tData as TemplateRow),
              require_room_number: toBool((tData as TemplateRow).require_room_number),
              require_audited_employee: toBool(
                (tData as TemplateRow).require_audited_employee
              ),
            };
          }
        }

        if (!tpl) throw new Error("No se encontró la auditoría.");
        setTemplate(tpl);
        setNameDraft(tpl.name ?? "");

        // Area + hotel areas
        let resolvedHotelId: string | null = tpl.hotel_id ?? null;
        if (tpl.area_id) {
          const { data: aData, error: aErr } = await supabase
            .from("areas")
            .select("id,name,type,hotel_id")
            .eq("id", tpl.area_id)
            .single();

          if (!aErr && aData) {
            const nextArea = aData as AreaRow;
            setArea(nextArea);
            if (!resolvedHotelId) resolvedHotelId = nextArea.hotel_id ?? null;

            if (nextArea.hotel_id) {
              const { data: hotelAreasData, error: hotelAreasErr } =
                await supabase
                  .from("areas")
                  .select("id,name,type,hotel_id")
                  .eq("hotel_id", nextArea.hotel_id)
                  .order("name", { ascending: true });

              if (hotelAreasErr) throw hotelAreasErr;
              setHotelAreas((hotelAreasData ?? []) as AreaRow[]);
            } else {
              setHotelAreas([nextArea]);
            }
          }
        } else {
          setArea(null);
          setHotelAreas([]);
        }
        setHotelId(resolvedHotelId);

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

        // Questions
        const secIds = secs.map((s) => s.id);
        let qList: QuestionRow[] = [];

        if (secIds.length) {
          const ownerDepartmentSelect =
            "id,audit_section_id,text,tag,owner_department,order,active,comment_requirement,photo_requirement,signature_requirement,created_at";
          const baseQuestionSelect =
            "id,audit_section_id,text,tag,order,active,comment_requirement,photo_requirement,signature_requirement,created_at";

          const { data: qData, error: qErr } = await supabase
            .from("audit_questions")
            .select(ownerDepartmentSelect)
            .in("audit_section_id", secIds)
            .order("order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true });

          if (qErr) {
            const message = safeStr(qErr.message);
            if (message.includes("owner_department")) {
              setOwnerDepartmentAvailable(false);

              const { data: fallbackData, error: fallbackErr } = await supabase
                .from("audit_questions")
                .select(baseQuestionSelect)
                .in("audit_section_id", secIds)
                .order("order", { ascending: true })
                .order("created_at", { ascending: true })
                .order("id", { ascending: true });

              if (fallbackErr) throw fallbackErr;
              qList = ((fallbackData ?? []) as QuestionRow[]).map((row) => ({
                ...row,
                owner_department: null,
              }));
            } else {
              throw qErr;
            }
          } else {
            qList = (qData ?? []) as QuestionRow[];
          }
        }

        // Certificaciones del hotel (Forbes / LHW / Meliá, etc.) y sus
        // etiquetas por pregunta. Defensivo: si la migración aún no está
        // desplegada en este entorno, se oculta la funcionalidad en vez de
        // romper el editor.
        const questionIds = qList.map((q) => q.id);
        const certByQuestion = new Map<string, string[]>();
        try {
          if (resolvedHotelId) {
            const { data: certData, error: certErr } = await supabase
              .from("certification_standards")
              .select("id,hotel_id,name,active")
              .eq("hotel_id", resolvedHotelId)
              .eq("active", true)
              .order("name", { ascending: true });
            if (certErr) throw certErr;
            setCertifications((certData ?? []) as CertificationStandardRow[]);
          } else {
            setCertifications([]);
          }

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
          setCertificationsAvailable(true);
        } catch {
          // Tabla(s) todavía no migradas en este entorno: se desactiva la
          // funcionalidad de certificaciones sin bloquear el resto del editor.
          setCertifications([]);
          setCertificationsAvailable(false);
        }

        // Build UI rows
        const secNameById = new Map<string, string>();
        for (const s of secs) secNameById.set(s.id, s.name ?? "Sin sección");

        const perSectionCounter = new Map<string, number>();
        const ui: UiRow[] = qList.map((q) => {
          const count = (perSectionCounter.get(q.audit_section_id) ?? 0) + 1;
          perSectionCounter.set(q.audit_section_id, count);
          return {
            questionId: q.id,
            certificationIds: certByQuestion.get(q.id) ?? [],
            sectionId: q.audit_section_id,
            classification:
              secNameById.get(q.audit_section_id) ?? "Sin sección",
            tag: safeStr(q.tag),
            standard: safeStr(q.text),
            owner_department: toResponsibleDepartment(q.owner_department),
            comment_requirement: toRequirement(q.comment_requirement),
            photo_requirement: toRequirement(q.photo_requirement),
            signature_requirement: toRequirement(q.signature_requirement),
            active: toBool(q.active),
            order: normalizeOrder(q.order, count),
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

        setRows(ui);
        setLoading(false);
      } catch (e: unknown) {
        setLoading(false);
        setError(e instanceof Error ? e.message : "Error cargando el editor.");
      }
    })();
  }, [templateId]);

  // ─── Derived / helpers ────────────────────────────────────────────────────

  const sectionIndex = useMemo(() => {
    const map = new Map<string, number>();
    sections.forEach((s, idx) => map.set(s.id, idx));
    return map;
  }, [sections]);

  function sortRows(list: UiRow[]) {
    return [...list].sort((a, b) => {
      const sa = sectionIndex.get(a.sectionId) ?? 999999;
      const sb = sectionIndex.get(b.sectionId) ?? 999999;
      if (sa !== sb) return sa - sb;
      if (a.order !== b.order) return a.order - b.order;
      return a.questionId.localeCompare(b.questionId);
    });
  }

  // ─── Mutation handlers ────────────────────────────────────────────────────

  async function updateQuestion(
    questionId: string,
    patch: Partial<QuestionRow>
  ) {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const { error: upErr } = await supabase
        .from("audit_questions")
        .update(patch as Database["public"]["Tables"]["audit_questions"]["Update"])
        .eq("id", questionId);
      if (upErr) throw upErr;

      setRows((prev) =>
        prev.map((r) => {
          if (r.questionId !== questionId) return r;
          const next = { ...r };
          if (patch.text !== undefined) next.standard = safeStr(patch.text);
          if (patch.tag !== undefined) next.tag = safeStr(patch.tag);
          if (patch.owner_department !== undefined)
            next.owner_department = toResponsibleDepartment(patch.owner_department);
          if (patch.comment_requirement !== undefined)
            next.comment_requirement = toRequirement(patch.comment_requirement);
          if (patch.photo_requirement !== undefined)
            next.photo_requirement = toRequirement(patch.photo_requirement);
          if (patch.signature_requirement !== undefined)
            next.signature_requirement = toRequirement(patch.signature_requirement);
          if (patch.active !== undefined) next.active = toBool(patch.active);
          if (patch.order !== undefined)
            next.order = normalizeOrder(patch.order, next.order);
          return next;
        })
      );
      setInfo("Guardado ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
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
      const { error: upErr } = await supabase
        .from("audit_templates")
        .update({ name: nextName })
        .eq("id", templateId);
      if (upErr) throw upErr;
      setTemplate((t) => (t ? { ...t, name: nextName } : t));
      setInfo("Nombre guardado ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el nombre.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTemplateRequirements(
    patch: Partial<
      Pick<TemplateRow, "require_room_number" | "require_audited_employee">
    >
  ) {
    if (!templateId || !template) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const { error: upErr } = await supabase
        .from("audit_templates")
        .update(patch)
        .eq("id", templateId);
      if (upErr) throw upErr;
      setTemplate((prev) => (prev ? { ...prev, ...patch } : prev));
      setInfo("Configuración guardada ✅");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar la configuración del template."
      );
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
      const next = !(template.active !== false);
      const { error: upErr } = await supabase
        .from("audit_templates")
        .update({ active: !next })
        .eq("id", templateId);
      if (upErr) throw upErr;
      setTemplate({ ...template, active: !next });
      setInfo(!next ? "Activada ✅" : "Desactivada ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    } finally {
      setSaving(false);
    }
  }

  async function applyQuickRules(kind: "comment" | "photo" | "signature") {
    const val =
      kind === "comment"
        ? quickComment
        : kind === "photo"
        ? quickPhoto
        : quickSignature;
    const ok = confirm(`¿Aplicar "${kind}" = "${val}" a TODAS las preguntas?`);
    if (!ok) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const field =
        kind === "comment"
          ? "comment_requirement"
          : kind === "photo"
          ? "photo_requirement"
          : "signature_requirement";

      const res = await fetch(`/api/templates/${templateId}/bulk-requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: val }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? json?.message ?? `Error ${res.status}`);
      }

      if (rows.length > 0) {
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            ...(kind === "comment" ? { comment_requirement: val } : {}),
            ...(kind === "photo" ? { photo_requirement: val } : {}),
            ...(kind === "signature" ? { signature_requirement: val } : {}),
          }))
        );
      }
      setInfo(`Reglas aplicadas ✅ (${json?.updated ?? rows.length} preguntas)`);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof (e as { message?: string })?.message === "string"
          ? (e as { message: string }).message
          : "No se pudo aplicar.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    const ok = confirm("¿Borrar esta pregunta?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const { error: delErr } = await supabase
        .from("audit_questions")
        .delete()
        .eq("id", questionId);
      if (delErr) throw delErr;
      setRows((prev) => prev.filter((r) => r.questionId !== questionId));
      setInfo("Borrada ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo borrar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAllFromTemplate() {
    if (!templateId) return;
    const ok = confirm(
      "¿Seguro? Esto borrará TODAS las preguntas y secciones de esta auditoría."
    );
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
      const sectionIds = (secs ?? []).map((s: { id: string }) => s.id);
      if (sectionIds.length > 0) {
        const { error: qDelErr } = await supabase
          .from("audit_questions")
          .delete()
          .in("audit_section_id", sectionIds);
        if (qDelErr) throw qDelErr;
      }
      const { error: sDelErr } = await supabase
        .from("audit_sections")
        .delete()
        .eq("audit_template_id", templateId);
      if (sDelErr) throw sDelErr;
      setRows([]);
      setSections([]);
      setInfo("Borrado completo ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo borrar.");
    } finally {
      setSaving(false);
    }
  }

  async function move(questionId: string, dir: "up" | "down") {
    const current = rows.find((r) => r.questionId === questionId);
    if (!current) return;
    const sameSection = rows
      .filter((r) => r.sectionId === current.sectionId)
      .sort(
        (a, b) => a.order - b.order || a.questionId.localeCompare(b.questionId)
      );
    const idx = sameSection.findIndex((r) => r.questionId === questionId);
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= sameSection.length) return;
    const target = sameSection[targetIdx];
    const aOrder = current.order;
    const bOrder = target.order;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const { error: e1 } = await supabase
        .from("audit_questions")
        .update({ order: bOrder })
        .eq("id", current.questionId);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("audit_questions")
        .update({ order: aOrder })
        .eq("id", target.questionId);
      if (e2) throw e2;
      setRows((prev) => {
        const swapped = prev.map((r) => {
          if (r.questionId === current.questionId) return { ...r, order: bOrder };
          if (r.questionId === target.questionId) return { ...r, order: aOrder };
          return r;
        });
        return sortRows(swapped);
      });
      setInfo("Orden actualizado ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo mover.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Inline cell handlers (local state only, save on blur/change) ─────────

  function handleTagChange(questionId: string, value: string) {
    setRows((prev) =>
      prev.map((x) => (x.questionId === questionId ? { ...x, tag: value } : x))
    );
  }

  function handleTagBlur(questionId: string, value: string) {
    updateQuestion(questionId, { tag: value || null });
  }

  function handleStandardChange(questionId: string, value: string) {
    setRows((prev) =>
      prev.map((x) =>
        x.questionId === questionId ? { ...x, standard: value } : x
      )
    );
  }

  function handleStandardBlur(questionId: string, value: string) {
    updateQuestion(questionId, { text: value });
  }

  function handleOwnerChange(questionId: string, value: string | null) {
    setRows((prev) =>
      prev.map((x) =>
        x.questionId === questionId ? { ...x, owner_department: value } : x
      )
    );
    updateQuestion(questionId, { owner_department: value });
  }

  function handleRequirementChange(
    questionId: string,
    field: string,
    value: RequirementType
  ) {
    setRows((prev) =>
      prev.map((x) =>
        x.questionId === questionId ? { ...x, [field]: value } : x
      )
    );
  }

  function handleRequirementSave(
    questionId: string,
    patch: Record<string, RequirementType>
  ) {
    updateQuestion(questionId, patch as Partial<QuestionRow>);
  }

  function handleActiveChange(questionId: string, value: boolean) {
    setRows((prev) =>
      prev.map((x) =>
        x.questionId === questionId ? { ...x, active: value } : x
      )
    );
    updateQuestion(questionId, { active: value });
  }

  // ─── Certificaciones (Forbes / LHW / Meliá, etc.) ─────────────────────────

  async function toggleCertification(
    questionId: string,
    certificationId: string,
    checked: boolean
  ) {
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
    } catch (e: unknown) {
      // revertir en caso de error
      setRows((prev) =>
        prev.map((x) => {
          if (x.questionId !== questionId) return x;
          const set = new Set(x.certificationIds);
          if (checked) set.delete(certificationId);
          else set.add(certificationId);
          return { ...x, certificationIds: Array.from(set) };
        })
      );
      setError(e instanceof Error ? e.message : "No se pudo actualizar el certificado.");
    } finally {
      setSaving(false);
    }
  }

  async function createCertification(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !hotelId) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("certification_standards")
        .insert({ hotel_id: hotelId, name: trimmed })
        .select("id,hotel_id,name,active")
        .single();
      if (insErr) throw insErr;
      setCertifications((prev) =>
        [...prev, data as CertificationStandardRow].sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        )
      );
      setInfo("Certificado creado ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear el certificado.");
    } finally {
      setSaving(false);
    }
  }

  async function renameCertification(certificationId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("certification_standards")
        .update({ name: trimmed })
        .eq("id", certificationId);
      if (upErr) throw upErr;
      setCertifications((prev) =>
        prev.map((c) => (c.id === certificationId ? { ...c, name: trimmed } : c))
      );
      setInfo("Certificado renombrado ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo renombrar el certificado.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateCertification(certificationId: string) {
    const ok = confirm(
      "¿Desactivar este certificado? Las preguntas ya etiquetadas conservarán la etiqueta, pero dejará de aparecer para nuevas ediciones."
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("certification_standards")
        .update({ active: false })
        .eq("id", certificationId);
      if (upErr) throw upErr;
      setCertifications((prev) => prev.filter((c) => c.id !== certificationId));
      setInfo("Certificado desactivado ✅");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo desactivar el certificado.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p>Cargando…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <BuilderHeader
        templateId={templateId ?? ""}
        template={template}
        saving={saving}
        error={error}
        info={info}
        ownerDepartmentAvailable={ownerDepartmentAvailable}
        onToggleActive={toggleTemplateActive}
      />

      <TemplateSettingsCard
        template={template}
        area={area}
        nameDraft={nameDraft}
        saving={saving}
        onNameChange={setNameDraft}
        onSaveName={saveTemplateName}
        onUpdateRequirements={updateTemplateRequirements}
      />

      {certificationsAvailable ? (
        <CertificationsManagerCard
          certifications={certifications}
          hotelIdAvailable={Boolean(hotelId)}
          saving={saving}
          onCreate={createCertification}
          onRename={renameCertification}
          onDeactivate={deactivateCertification}
        />
      ) : null}

      <QuickRulesCard
        totalCount={rows.length}
        saving={saving}
        quickComment={quickComment}
        quickPhoto={quickPhoto}
        quickSignature={quickSignature}
        onQuickCommentChange={setQuickComment}
        onQuickPhotoChange={setQuickPhoto}
        onQuickSignatureChange={setQuickSignature}
        onApplyComment={() => applyQuickRules("comment")}
        onApplyPhoto={() => applyQuickRules("photo")}
        onApplySignature={() => applyQuickRules("signature")}
      />

      <QuestionsTable
        rows={rows}
        saving={saving}
        certifications={certifications}
        onToggleCertification={toggleCertification}
        ownerDepartmentAvailable={ownerDepartmentAvailable}
        responsibleDepartmentOptions={responsibleDepartmentOptions}
        templateResponsibleLabel={templateResponsibleLabel}
        responsibleDepartmentLabelByValue={responsibleDepartmentLabelByValue}
        onMove={move}
        onTagChange={handleTagChange}
        onTagBlur={handleTagBlur}
        onStandardChange={handleStandardChange}
        onStandardBlur={handleStandardBlur}
        onOwnerChange={handleOwnerChange}
        onRequirementChange={handleRequirementChange}
        onRequirementSave={handleRequirementSave}
        onActiveChange={handleActiveChange}
        onDelete={deleteQuestion}
        onDeleteAll={deleteAllFromTemplate}
      />
    </main>
  );
}
