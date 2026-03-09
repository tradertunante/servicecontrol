import { supabase } from "@/lib/supabaseClient";
import type {
  AuditReportData,
  AuditReportItem,
  AuditReportSection,
  AuditReportTimelineEvent,
} from "./auditReportTypes";

type AuditRunRow = {
  id: string;
  area_id: string;
  audit_template_id: string;
  status: string | null;
  score: number | null;
  executed_at: string | null;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
};

type AnswerRow = {
  question_id: string;
  result: string | null;
  answer: string | null;
  comment: string | null;
};

type QuestionRow = {
  id: string;
  text: string;
  audit_section_id: string | null;
};

type SectionRow = {
  id: string;
  name: string;
};

type TrainingLogRow = {
  confirmed_at: string | null;
};

type AssignmentLogRow = {
  changed_at: string | null;
};

function normalizeStatus(a: AnswerRow | undefined): "FAIL" | "NA" | "OK" {
  const raw = (a?.result ?? a?.answer ?? "").toString().trim().toUpperCase();
  if (raw === "FAIL") return "FAIL";
  if (raw === "NA" || raw === "N/A") return "NA";
  return "OK";
}

export async function buildAuditReportData(runId: string): Promise<AuditReportData> {
  const { data: runData, error: runErr } = await supabase
    .from("audit_runs")
    .select("id,area_id,audit_template_id,status,score,executed_at")
    .eq("id", runId)
    .single();

  if (runErr || !runData) {
    throw runErr ?? new Error("No se encontró la auditoría.");
  }

  const run = runData as AuditRunRow;

  const [
    { data: areaData, error: areaErr },
    { data: templateData, error: templateErr },
    { data: answersData, error: answersErr },
    { data: trainingLogsData, error: trainingErr },
    { data: assignmentLogsData, error: assignmentErr },
  ] = await Promise.all([
    supabase.from("areas").select("id,name,type").eq("id", run.area_id).single(),
    supabase
      .from("audit_templates")
      .select("id,name")
      .eq("id", run.audit_template_id)
      .single(),
    supabase
      .from("audit_answers")
      .select("question_id,result,answer,comment")
      .eq("audit_run_id", runId),
    supabase
      .from("reaudit_training_logs")
      .select("confirmed_at")
      .eq("reaudit_run_id", runId)
      .order("confirmed_at", { ascending: true }),
    supabase
      .from("reaudit_assignment_logs")
      .select("changed_at")
      .eq("reaudit_run_id", runId)
      .order("changed_at", { ascending: true }),
  ]);

  if (areaErr) throw areaErr;
  if (templateErr) throw templateErr;
  if (answersErr) throw answersErr;
  if (trainingErr) throw trainingErr;
  if (assignmentErr) throw assignmentErr;

  const area = (areaData as AreaRow | null) ?? null;
  const template = (templateData as TemplateRow | null) ?? null;
  const answers = (answersData ?? []) as AnswerRow[];

  const qids = answers.map((a) => a.question_id).filter(Boolean);

  let items: AuditReportItem[] = [];
  let sections: AuditReportSection[] = [];

  if (qids.length > 0) {
    const { data: questionsData, error: questionsErr } = await supabase
      .from("audit_questions")
      .select("id,text,audit_section_id")
      .in("id", qids);

    if (questionsErr) throw questionsErr;

    const questions = (questionsData ?? []) as QuestionRow[];

    const sectionIds = Array.from(
      new Set(
        questions
          .map((q) => q.audit_section_id)
          .filter((x): x is string => typeof x === "string" && x.length > 0)
      )
    );

    let sectionRows: SectionRow[] = [];

    if (sectionIds.length > 0) {
      const { data: sectionsData, error: sectionsErr } = await supabase
        .from("audit_sections")
        .select("id,name")
        .in("id", sectionIds);

      if (sectionsErr) throw sectionsErr;
      sectionRows = (sectionsData ?? []) as SectionRow[];
    }

    const sectionNameById = new Map<string, string>();
    for (const s of sectionRows) {
      sectionNameById.set(s.id, s.name);
    }

    const answerByQuestionId = new Map<string, AnswerRow>();
    for (const a of answers) {
      answerByQuestionId.set(a.question_id, a);
    }

    items = questions.map((q) => {
      const answer = answerByQuestionId.get(q.id);
      const section_id = q.audit_section_id ?? "no_section";
      const section_name = sectionNameById.get(section_id) ?? "Sin sección";

      return {
        question_id: q.id,
        question_text: q.text,
        section_id,
        section_name,
        status: normalizeStatus(answer),
        comment: (answer?.comment ?? "").trim() || null,
      };
    });

    items.sort((a, b) => {
      const sa = a.section_name.toLowerCase();
      const sb = b.section_name.toLowerCase();
      if (sa !== sb) return sa.localeCompare(sb);
      return a.question_text.localeCompare(b.question_text);
    });

    const grouped = new Map<string, AuditReportSection>();

    for (const item of items) {
      if (!grouped.has(item.section_id)) {
        grouped.set(item.section_id, {
          section_id: item.section_id,
          section_name: item.section_name,
          total: 0,
          fail: 0,
          na: 0,
          ok: 0,
          items: [],
        });
      }

      const bucket = grouped.get(item.section_id)!;
      bucket.items.push(item);
      bucket.total += 1;

      if (item.status === "FAIL") bucket.fail += 1;
      else if (item.status === "NA") bucket.na += 1;
      else bucket.ok += 1;
    }

    sections = Array.from(grouped.values()).sort((a, b) =>
      a.section_name.toLowerCase().localeCompare(b.section_name.toLowerCase())
    );
  }

  let fail = 0;
  let na = 0;
  let ok = 0;

  for (const item of items) {
    if (item.status === "FAIL") fail += 1;
    else if (item.status === "NA") na += 1;
    else ok += 1;
  }

  const timeline: AuditReportTimelineEvent[] = [
    {
      type: "executed",
      label: "Auditoría ejecutada",
      date: run.executed_at,
    },
    ...((trainingLogsData ?? []) as TrainingLogRow[]).map((row, idx) => ({
      type: "training_confirmed",
      label: `Training confirmado${idx > 0 ? ` #${idx + 1}` : ""}`,
      date: row.confirmed_at,
    })),
    ...((assignmentLogsData ?? []) as AssignmentLogRow[]).map((row, idx) => ({
      type: "auditor_reassigned",
      label: `Auditor reasignado${idx > 0 ? ` #${idx + 1}` : ""}`,
      date: row.changed_at,
    })),
  ].filter((x) => !!x.date);

  timeline.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });

  return {
    run: {
      id: run.id,
      area_id: run.area_id,
      audit_template_id: run.audit_template_id,
      status: run.status,
      score: run.score,
      executed_at: run.executed_at,
    },
    area,
    template,
    summary: {
      total: items.length,
      fail,
      na,
      ok,
    },
    sections,
    timeline,
  };
}