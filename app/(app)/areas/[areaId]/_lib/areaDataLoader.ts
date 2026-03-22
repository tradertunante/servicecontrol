"use client";

import { supabase } from "@/lib/supabaseClient";

import type {
  AnswerRow,
  Area,
  AuditRunRow,
  AuditTemplate,
  QuestionMeta,
  SectionTotal,
} from "./areaTypes";

type SectionExceptions = {
  fail: number;
  na: number;
};

type TemplateRow = {
  id: string;
  name: string;
  active?: boolean | null;
};

type TemplateNameRow = {
  id: string;
  name: string;
};

type QuestionSectionJoinItem = {
  id: string;
  name: string;
  audit_template_id?: string | null;
} | null;

type QuestionTotalsRow = {
  audit_section_id: string | null;
  audit_sections: QuestionSectionJoinItem[] | QuestionSectionJoinItem;
};

type QuestionMetaSection = {
  id: string;
  name: string;
};

type QuestionMetaRow = {
  id: string;
  text: string | null;
  tag?: string | null;
  classification?: string | null;
  audit_section_id: string | null;
  audit_sections: QuestionMetaSection[] | QuestionMetaSection | null;
};

function getTotalsSection(value: QuestionTotalsRow["audit_sections"]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function getMetaSection(value: QuestionMetaRow["audit_sections"]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export type AreaOverviewData = {
  area: Area;
  templates: AuditTemplate[];
  runs: AuditRunRow[];
  templateNameById: Record<string, string>;
  executorNameById: Record<string, string>;
  totalsByTemplate: Record<string, Record<string, SectionTotal>>;
  exceptionsByRun: Record<string, Record<string, SectionExceptions>>;
  answersByRun: Record<string, AnswerRow[]>;
  questionMetaById: Record<string, QuestionMeta>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function getAccessToken() {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.access_token ?? null;
}

async function fetchExecutorNames(areaId: string, executorIds: string[]) {
  const accessToken = await getAccessToken();
  if (!accessToken || executorIds.length === 0) {
    return {};
  }

  const response = await fetch("/api/profiles/names", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ ids: executorIds, area_id: areaId }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
  const map: Record<string, string> = {};

  for (const item of items) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    map[item.id] = typeof item.full_name === "string" && item.full_name.trim() ? item.full_name : item.id;
  }

  return map;
}

function buildTemplateNameMap(rows: TemplateNameRow[]) {
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.id] = row.name;
    return acc;
  }, {});
}

function buildQuestionTotals(rows: QuestionTotalsRow[]) {
  return rows.reduce<Record<string, Record<string, SectionTotal>>>((acc, row) => {
    const joinedSection = getTotalsSection(row.audit_sections);
    const templateId = joinedSection?.audit_template_id ?? null;
    const sectionId = joinedSection?.id ?? row.audit_section_id ?? null;

    if (!templateId || !sectionId) {
      return acc;
    }

    if (!acc[templateId]) acc[templateId] = {};
    if (!acc[templateId][sectionId]) {
      acc[templateId][sectionId] = {
        section_id: sectionId,
        section_name: joinedSection?.name ?? "Sin sección",
        total_questions: 0,
      };
    }

    acc[templateId][sectionId].total_questions += 1;
    return acc;
  }, {});
}

function buildAnswersByRun(rows: AnswerRow[]) {
  return rows.reduce<Record<string, AnswerRow[]>>((acc, row) => {
    if (!acc[row.audit_run_id]) acc[row.audit_run_id] = [];
    acc[row.audit_run_id].push(row);
    return acc;
  }, {});
}

function buildQuestionMetaMap(rows: QuestionMetaRow[]) {
  return rows.reduce<Record<string, QuestionMeta>>((acc, row) => {
    const joinedSection = getMetaSection(row.audit_sections);
    const sectionName = joinedSection?.name ?? "Sin sección";
    const sectionId = joinedSection?.id ?? row.audit_section_id ?? "unknown";
    const classification = String(row.classification ?? "").trim() || sectionName;

    acc[row.id] = {
      id: row.id,
      text: row.text ?? "(Sin texto)",
      audit_section_id: sectionId,
      section_name: sectionName,
      tag: row.tag ?? null,
      classification,
    };
    return acc;
  }, {});
}

function buildExceptionsByRun(
  answers: AnswerRow[],
  questionMetaById: Record<string, QuestionMeta>,
) {
  return answers.reduce<Record<string, Record<string, SectionExceptions>>>((acc, row) => {
    const runId = row.audit_run_id;
    const result = String(row.result ?? "").toUpperCase();
    const sectionId = questionMetaById[row.question_id]?.audit_section_id ?? "unknown";

    if (!acc[runId]) acc[runId] = {};
    if (!acc[runId][sectionId]) acc[runId][sectionId] = { fail: 0, na: 0 };

    if (result === "FAIL") acc[runId][sectionId].fail += 1;
    if (result === "NA") acc[runId][sectionId].na += 1;

    return acc;
  }, {});
}

export async function loadAreaOverviewData(
  areaId: string,
  options?: {
    includeAnswerDetails?: boolean;
  },
): Promise<AreaOverviewData> {
  const includeAnswerDetails = options?.includeAnswerDetails ?? false;

  const { data: areaData, error: areaError } = await supabase
    .from("areas")
    .select("id,name,type,hotel_id")
    .eq("id", areaId)
    .single();

  if (areaError || !areaData) {
    throw areaError ?? new Error("Área no encontrada");
  }

  const { data: templateData, error: templateError } = await supabase
    .from("audit_templates")
    .select("id,name,active,area_id")
    .eq("area_id", areaId)
    .order("name", { ascending: true });

  if (templateError) {
    throw templateError;
  }

  const templates = ((templateData ?? []) as TemplateRow[]).filter((template) => template.active !== false);

  const { data: runData, error: runError } = await supabase
    .from("audit_runs")
    .select("id,status,score,notes,executed_at,executed_by,audit_template_id,area_id")
    .eq("area_id", areaId)
    .is("archived_at", null)
    .order("executed_at", { ascending: false })
    .limit(80);

  if (runError) {
    throw runError;
  }

  const allRuns = (runData ?? []) as AuditRunRow[];
  const submittedRuns = allRuns.filter((run) => (run.status ?? "").toLowerCase() === "submitted");
  const runs = submittedRuns.length > 0 ? submittedRuns : allRuns;

  const runIds = Array.from(new Set(runs.map((run) => run.id)));
  const templateIds = Array.from(new Set(runs.map((run) => run.audit_template_id)));
  const executorIds = Array.from(
    new Set(runs.map((run) => run.executed_by).filter((value): value is string => Boolean(value))),
  );

  const [templateNameById, executorNameById] = await Promise.all([
    (async () => {
      if (templateIds.length === 0) return {};

      const { data, error } = await supabase
        .from("audit_templates")
        .select("id,name")
        .in("id", templateIds);

      if (error) throw error;
      return buildTemplateNameMap((data ?? []) as TemplateNameRow[]);
    })(),
    fetchExecutorNames(areaId, executorIds),
  ]);

  const totalsByTemplate = await (async () => {
    if (templateIds.length === 0) return {};

    const { data, error } = await supabase
      .from("audit_questions")
      .select(`
        audit_section_id,
        audit_sections!inner (
          id,
          name,
          audit_template_id
        )
      `)
      .in("audit_sections.audit_template_id", templateIds)
      .eq("active", true);

    if (error) throw error;
    return buildQuestionTotals((data ?? []) as QuestionTotalsRow[]);
  })();

  let answersByRun: Record<string, AnswerRow[]> = {};
  let questionMetaById: Record<string, QuestionMeta> = {};
  let exceptionsByRun: Record<string, Record<string, SectionExceptions>> = {};

  if (runIds.length > 0) {
    const { data: answerData, error: answerError } = await supabase
      .from("audit_answers")
      .select("audit_run_id,question_id,result")
      .in("audit_run_id", runIds);

    if (answerError) {
      throw answerError;
    }

    const answers = (answerData ?? []) as AnswerRow[];
    answersByRun = buildAnswersByRun(answers);

    if (includeAnswerDetails) {
      const questionIds = Array.from(new Set(answers.map((answer) => answer.question_id)));

      if (questionIds.length > 0) {
        const { data: questionData, error: questionError } = await supabase
          .from("audit_questions")
          .select(`
            id,
            text,
            tag,
            classification,
            audit_section_id,
            audit_sections (
              id,
              name
            )
          `)
          .in("id", questionIds);

        if (questionError) {
          throw questionError;
        }

        questionMetaById = buildQuestionMetaMap((questionData ?? []) as QuestionMetaRow[]);
      }
    } else {
      const { data: questionData, error: questionError } = await supabase
        .from("audit_questions")
        .select(`
          id,
          text,
          audit_section_id,
          audit_sections (
            id,
            name
          )
        `)
        .in("id", Array.from(new Set(answers.map((answer) => answer.question_id))));

      if (questionError) {
        throw questionError;
      }

      questionMetaById = buildQuestionMetaMap((questionData ?? []) as QuestionMetaRow[]);
    }

    exceptionsByRun = buildExceptionsByRun(answers, questionMetaById);
  }

  return {
    area: areaData as Area,
    templates,
    runs,
    templateNameById,
    executorNameById,
    totalsByTemplate,
    exceptionsByRun,
    answersByRun,
    questionMetaById,
  };
}

export function getAreaDataErrorMessage(error: unknown, fallback: string) {
  return getErrorMessage(error, fallback);
}
