"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";

import { getAreaDataErrorMessage, loadAreaOverviewData } from "../_lib/areaDataLoader";
import type {
  Area,
  AuditRunRow,
  AuditTemplate,
  AnswerRow,
  QuestionMeta,
  SectionTotal,
} from "../_lib/areaTypes";
export function useAreaData({
  areaId,
  templateFilter,
  setTemplateFilter,
  initialProfile,
}: {
  areaId: string;
  templateFilter: string;
  setTemplateFilter: (v: string) => void;
  initialProfile?: Profile;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile] = useState<Profile | null>(initialProfile ?? null);
  const [area, setArea] = useState<Area | null>(null);

  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [runs, setRuns] = useState<AuditRunRow[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Record<string, string>>({});
  const [executorNameById, setExecutorNameById] = useState<Record<string, string>>({});
  const [totalsByTemplate, setTotalsByTemplate] = useState<Record<string, Record<string, SectionTotal>>>({});
  const [exceptionsByRun, setExceptionsByRun] = useState<Record<string, Record<string, { fail: number; na: number }>>>(
    {}
  );

  const [answersByRun, setAnswersByRun] = useState<Record<string, AnswerRow[]>>({});
  const [questionMetaById, setQuestionMetaById] = useState<Record<string, QuestionMeta>>({});

  useEffect(() => {
    if (!areaId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const overview = await loadAreaOverviewData(areaId, { includeAnswerDetails: true });
        setArea(overview.area);
        setTemplates(overview.templates);

        if (templateFilter !== "ALL") {
          const exists = overview.templates.some((template) => template.id === templateFilter);
          if (!exists) setTemplateFilter("ALL");
        }

        setRuns(overview.runs);
        setTemplateNameById(overview.templateNameById);
        setExecutorNameById(overview.executorNameById);
        setTotalsByTemplate(overview.totalsByTemplate);
        setExceptionsByRun(overview.exceptionsByRun);
        setAnswersByRun(overview.answersByRun);
        setQuestionMetaById(overview.questionMetaById);

        setLoading(false);
      } catch (e: unknown) {
        setLoading(false);
        setError(getAreaDataErrorMessage(e, "Error cargando área."));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, router]);

  // ✅ FIX: crear auditoría con audit_channel válido (internal | quality)
  async function handleStart(templateId: string) {
    if (!areaId) return;

    setStarting(templateId);
    setError(null);

    try {
      const response = await fetch("/api/audits/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          area_id: areaId,
          audit_template_id: templateId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.run_id) {
        throw new Error(payload?.error ?? "No se pudo crear la auditoría.");
      }

      router.push(`/audits/${payload.run_id}`);
    } catch (e: unknown) {
      setError(getAreaDataErrorMessage(e, "No se pudo iniciar la auditoría."));
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
