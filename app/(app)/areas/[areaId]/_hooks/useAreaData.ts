// FILE: app/(app)/areas/[areaId]/_hooks/useAreaData.ts
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canRunAudits } from "@/lib/auth/permissions";

import type {
  Area,
  AuditRunRow,
  AuditTemplate,
  AnswerRow,
  QuestionMeta,
  SectionTotal,
} from "../_lib/areaTypes";

const HOTEL_KEY = "sc_hotel_id";

export function useAreaData({
  areaId,
  templateFilter,
  setTemplateFilter,
}: {
  areaId: string;
  templateFilter: string;
  setTemplateFilter: (v: string) => void;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [area, setArea] = useState<Area | null>(null);

  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Record<string, string>>({});
  const [executorNameById, setExecutorNameById] = useState<Record<string, string>>({});
  const [totalsByTemplate, setTotalsByTemplate] = useState<Record<string, Record<string, SectionTotal>>>({});
  const [exceptionsByRun, setExceptionsByRun] = useState<Record<string, Record<string, { fail: number; na: number }>>>({});

  const [answersByRun, setAnswersByRun] = useState<Record<string, AnswerRow[]>>({});
  const [questionMetaById, setQuestionMetaById] = useState<Record<string, QuestionMeta>>({});

  useEffect(() => {
    if (!areaId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const p = await requireRoleOrRedirect(router, ["admin", "manager", "auditor", "superadmin"], "/areas");
        if (!p) return;
        setProfile(p);

        const allowed = p.role === "superadmin" ? true : canRunAudits(p.role);
        if (!allowed) {
          setError("No tienes permisos para acceder a esta sección.");
          setLoading(false);
          return;
        }

        // 1) Área
        const { data: areaData, error: areaErr } = await supabase
          .from("areas")
          .select("id,name,type,hotel_id")
          .eq("id", areaId)
          .single();

        if (areaErr || !areaData) throw areaErr ?? new Error("Área no encontrada");
        setArea(areaData as Area);

        // 2) Templates del área
        const { data: tData, error: tErr } = await supabase
          .from("audit_templates")
          .select("id,name,active,area_id")
          .eq("area_id", areaId)
          .order("name", { ascending: true });

        if (tErr) throw tErr;

        const onlyActive = (tData ?? []).filter((t: any) => t.active !== false) as AuditTemplate[];
        setTemplates(onlyActive);

        if (templateFilter !== "ALL") {
          const exists = onlyActive.some((x) => x.id === templateFilter);
          if (!exists) setTemplateFilter("ALL");
        }

        // 3) Runs
        const { data: runData, error: runErr } = await supabase
          .from("audit_runs")
          .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
          .eq("area_id", areaId)
          .order("executed_at", { ascending: false })
          .limit(80);

        if (runErr) throw runErr;

        const allRuns = (runData ?? []) as AuditRunRow[];
        const submitted = allRuns.filter((r) => (r.status ?? "").toLowerCase() === "submitted");
        const finalRuns = submitted.length ? submitted : allRuns;
        setRuns(finalRuns);

        const runIds = Array.from(new Set(finalRuns.map((r) => r.id)));
        const templateIds = Array.from(new Set(finalRuns.map((r) => r.audit_template_id)));
        const executorIds = Array.from(new Set(finalRuns.map((r) => r.executed_by).filter(Boolean) as string[]));

        // 4) Nombres templates
        if (templateIds.length) {
          const { data: tplData, error: tplErr } = await supabase.from("audit_templates").select("id,name").in("id", templateIds);
          if (tplErr) throw tplErr;

          const map: Record<string, string> = {};
          for (const row of (tplData ?? []) as any[]) map[row.id] = row.name;
          setTemplateNameById(map);
        }

        // 5) Nombres ejecutores
        if (executorIds.length) {
          const { data: pData, error: pErr } = await supabase.from("profiles").select("id,full_name").in("id", executorIds);
          if (!pErr && pData) {
            const map: Record<string, string> = {};
            for (const row of pData as any[]) map[row.id] = row.full_name ?? row.id;
            setExecutorNameById(map);
          }
        }

        // 6) Totales por sección
        if (templateIds.length) {
          const { data: qData, error: qErr } = await supabase
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
            .in("audit_sections.audit_template_id", templateIds)
            .eq("active", true);

          if (qErr) throw qErr;

          const totals: Record<string, Record<string, SectionTotal>> = {};

          for (const row of (qData ?? []) as any[]) {
            const tplId = row.audit_sections?.audit_template_id as string | undefined;
            const secId = (row.audit_sections?.id ?? row.audit_section_id) as string | undefined;
            const secName = (row.audit_sections?.name ?? "Sin sección") as string;

            if (!tplId || !secId) continue;

            if (!totals[tplId]) totals[tplId] = {};
            if (!totals[tplId][secId]) totals[tplId][secId] = { section_id: secId, section_name: secName, total_questions: 0 };
            totals[tplId][secId].total_questions += 1;
          }

          setTotalsByTemplate(totals);
        }

        // 7) Answers + meta preguntas (✅ ahora incluye tag/classification)
        if (runIds.length) {
          const { data: aData, error: aErr } = await supabase
            .from("audit_answers")
            .select("audit_run_id,question_id,result")
            .in("audit_run_id", runIds);

          if (aErr) throw aErr;

          const answers = (aData ?? []) as AnswerRow[];

          const byRun: Record<string, AnswerRow[]> = {};
          for (const a of answers) {
            if (!byRun[a.audit_run_id]) byRun[a.audit_run_id] = [];
            byRun[a.audit_run_id].push(a);
          }
          setAnswersByRun(byRun);

          const questionIds = Array.from(new Set(answers.map((a) => a.question_id)));

          const qMetaMap: Record<string, QuestionMeta> = {};
          if (questionIds.length) {
            const { data: q2Data, error: q2Err } = await supabase
              .from("audit_questions")
              .select(
                `
                id,
                text,
                tag,
                classification,
                audit_section_id,
                audit_sections (
                  id,
                  name
                )
              `
              )
              .in("id", questionIds);

            if (q2Err) throw q2Err;

            for (const q of (q2Data ?? []) as any[]) {
              const secId = (q.audit_sections?.id ?? q.audit_section_id ?? "unknown") as string;
              const secName = (q.audit_sections?.name ?? "Sin sección") as string;

              qMetaMap[q.id] = {
                id: q.id,
                text: q.text ?? "(Sin texto)",
                audit_section_id: secId,
                section_name: secName,
                tag: q.tag ?? null,
                classification: q.classification ?? null,
              };
            }
          }
          setQuestionMetaById(qMetaMap);

          const ex: Record<string, Record<string, { fail: number; na: number }>> = {};

          for (const row of answers) {
            const rid = row.audit_run_id;
            const res = String(row.result ?? "").toUpperCase();
            const secId = qMetaMap[row.question_id]?.audit_section_id ?? "unknown";

            if (!ex[rid]) ex[rid] = {};
            if (!ex[rid][secId]) ex[rid][secId] = { fail: 0, na: 0 };

            if (res === "FAIL") ex[rid][secId].fail += 1;
            if (res === "NA") ex[rid][secId].na += 1;
          }

          setExceptionsByRun(ex);
        }

        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message ?? "Error cargando área.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, router]);

  async function handleStart(templateId: string) {
    if (!profile || !areaId) return;

    setStarting(templateId);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw userErr ?? new Error("No hay sesión activa.");

      const nowIso = new Date().toISOString();

      const hotelIdFromLocalStorage = typeof window !== "undefined" ? localStorage.getItem(HOTEL_KEY) : null;
      const hotelIdToUse = area?.hotel_id ?? profile?.hotel_id ?? hotelIdFromLocalStorage;

      if (!hotelIdToUse) throw new Error("No se pudo determinar el hotel_id para crear la auditoría.");

      const { data, error } = await supabase
        .from("audit_runs")
        .insert({
          hotel_id: hotelIdToUse,
          area_id: areaId,
          audit_template_id: templateId,
          status: "draft",
          score: null,
          notes: null,
          executed_at: nowIso,
          executed_by: user.id,
        })
        .select("id")
        .single();

      if (error || !data) throw error ?? new Error("No se pudo crear la auditoría.");

      router.push(`/audits/${data.id}`);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar la auditoría.");
    } finally {
      setStarting(null);
    }
  }

  function removeRunEverywhere(runId: string) {
    setRuns((prev) => prev.filter((x) => x.id !== runId));

    setAnswersByRun((prev) => {
      const copy = { ...prev };
      delete copy[runId];
      return copy;
    });

    setExceptionsByRun((prev) => {
      const copy = { ...prev };
      delete copy[runId];
      return copy;
    });
  }

  return {
    loading,
    error,
    starting,

    profile,
    area,

    templates,
    runs,

    templateNameById,
    executorNameById,

    totalsByTemplate,
    exceptionsByRun,

    answersByRun,
    questionMetaById,

    handleStart,
    removeRunEverywhere,
  };
}