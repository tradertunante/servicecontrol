import { supabase } from "@/lib/supabaseClient";
import type {
  WeeklyAreaAuditRow,
  WeeklyAreaReportData,
  WeeklyAreaSectionRow,
  WeeklyAreaTopFailureRow,
} from "./weeklyReportTypes";

type AuditRunRow = {
  id: string;
  area_id: string;
  audit_template_id: string;
  auditor_id: string | null;
  score: number | null;
  executed_at: string | null;
};

type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id?: string | null;
};

type HotelRow = {
  id: string;
  name: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
};

type AnswerRow = {
  audit_run_id: string;
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

function normalizeStatus(a: { result: string | null; answer: string | null }): "FAIL" | "NA" | "OK" {
  const raw = (a.result ?? a.answer ?? "").toString().trim().toUpperCase();
  if (raw === "FAIL") return "FAIL";
  if (raw === "NA" || raw === "N/A") return "NA";
  return "OK";
}

function formatRangeLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);

  const startLabel = start.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const endLabel = end.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

export async function buildWeeklyAreaReport(args: {
  areaId: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
}): Promise<WeeklyAreaReportData> {
  const { areaId, weekStart, weekEnd } = args;

  const weekEndExclusive = new Date(`${weekEnd}T00:00:00`);
  weekEndExclusive.setDate(weekEndExclusive.getDate() + 1);
  const weekEndExclusiveStr = weekEndExclusive.toISOString().slice(0, 10);

  const { data: areaData, error: areaErr } = await supabase
    .from("areas")
    .select("id,name,type,hotel_id")
    .eq("id", areaId)
    .single();

  if (areaErr || !areaData) {
    throw areaErr ?? new Error("No se encontró el área.");
  }

  const area = areaData as AreaRow;

  let hotel: HotelRow | null = null;
  if (area.hotel_id) {
    const { data: hotelData } = await supabase
      .from("hotels")
      .select("id,name")
      .eq("id", area.hotel_id)
      .maybeSingle();

    hotel = (hotelData as HotelRow | null) ?? null;
  }

  const { data: runData, error: runErr } = await supabase
    .from("audit_runs")
    .select("id,area_id,audit_template_id,auditor_id,score,executed_at")
    .eq("area_id", areaId)
    .gte("executed_at", `${weekStart}T00:00:00`)
    .lt("executed_at", `${weekEndExclusiveStr}T00:00:00`)
    .order("executed_at", { ascending: true });

  if (runErr) throw runErr;

  const runs = (runData ?? []) as AuditRunRow[];
  const runIds = runs.map((r) => r.id);
  const templateIds = Array.from(new Set(runs.map((r) => r.audit_template_id).filter(Boolean)));
  const auditorIds = Array.from(new Set(runs.map((r) => r.auditor_id).filter(Boolean))) as string[];

  let templates: TemplateRow[] = [];
  if (templateIds.length > 0) {
    const { data } = await supabase
      .from("audit_templates")
      .select("id,name")
      .in("id", templateIds);
    templates = (data ?? []) as TemplateRow[];
  }

  let auditors: ProfileRow[] = [];
  if (auditorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,name")
      .in("id", auditorIds);
    auditors = (data ?? []) as ProfileRow[];
  }

  let answers: AnswerRow[] = [];
  if (runIds.length > 0) {
    const { data, error } = await supabase
      .from("audit_answers")
      .select("audit_run_id,question_id,result,answer,comment")
      .in("audit_run_id", runIds);

    if (error) throw error;
    answers = (data ?? []) as AnswerRow[];
  }

  const questionIds = Array.from(new Set(answers.map((a) => a.question_id).filter(Boolean)));

  let questions: QuestionRow[] = [];
  if (questionIds.length > 0) {
    const { data, error } = await supabase
      .from("audit_questions")
      .select("id,text,audit_section_id")
      .in("id", questionIds);

    if (error) throw error;
    questions = (data ?? []) as QuestionRow[];
  }

  const sectionIds = Array.from(
    new Set(
      questions
        .map((q) => q.audit_section_id)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    )
  );

  let sections: SectionRow[] = [];
  if (sectionIds.length > 0) {
    const { data, error } = await supabase
      .from("audit_sections")
      .select("id,name")
      .in("id", sectionIds);

    if (error) throw error;
    sections = (data ?? []) as SectionRow[];
  }

  const templateById = new Map(templates.map((t) => [t.id, t.name]));
  const auditorById = new Map(
    auditors.map((a) => [a.id, a.full_name ?? a.name ?? null])
  );
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));

  const answersByRunId = new Map<string, AnswerRow[]>();
  for (const answer of answers) {
    if (!answersByRunId.has(answer.audit_run_id)) {
      answersByRunId.set(answer.audit_run_id, []);
    }
    answersByRunId.get(answer.audit_run_id)!.push(answer);
  }

  const audits: WeeklyAreaAuditRow[] = runs.map((run) => {
    const runAnswers = answersByRunId.get(run.id) ?? [];

    let fail = 0;
    let na = 0;
    let ok = 0;

    for (const answer of runAnswers) {
      const status = normalizeStatus(answer);
      if (status === "FAIL") fail += 1;
      else if (status === "NA") na += 1;
      else ok += 1;
    }

    return {
      run_id: run.id,
      executed_at: run.executed_at,
      template_name: templateById.get(run.audit_template_id) ?? "Template",
      auditor_name: run.auditor_id ? auditorById.get(run.auditor_id) ?? null : null,
      score: run.score,
      fail,
      na,
      ok,
      total: runAnswers.length,
    };
  });

  const topFailureMap = new Map<string, WeeklyAreaTopFailureRow>();
  for (const answer of answers) {
    const status = normalizeStatus(answer);
    if (status !== "FAIL") continue;

    const question = questionById.get(answer.question_id);
    if (!question) continue;

    const key = question.id;
    const sectionName =
      question.audit_section_id
        ? sectionNameById.get(question.audit_section_id) ?? "Sin sección"
        : "Sin sección";

    if (!topFailureMap.has(key)) {
      topFailureMap.set(key, {
        question_id: question.id,
        question_text: question.text,
        section_name: sectionName,
        fail_count: 0,
      });
    }

    topFailureMap.get(key)!.fail_count += 1;
  }

  const top_failures = Array.from(topFailureMap.values())
    .sort((a, b) => b.fail_count - a.fail_count || a.question_text.localeCompare(b.question_text))
    .slice(0, 5);

  const sectionSummaryMap = new Map<string, WeeklyAreaSectionRow>();
  for (const answer of answers) {
    const question = questionById.get(answer.question_id);
    const sectionId = question?.audit_section_id ?? "no_section";
    const sectionName =
      question?.audit_section_id
        ? sectionNameById.get(question.audit_section_id) ?? "Sin sección"
        : "Sin sección";

    if (!sectionSummaryMap.has(sectionId)) {
      sectionSummaryMap.set(sectionId, {
        section_id: sectionId,
        section_name: sectionName,
        fail: 0,
        na: 0,
        ok: 0,
        total: 0,
      });
    }

    const row = sectionSummaryMap.get(sectionId)!;
    const status = normalizeStatus(answer);

    row.total += 1;
    if (status === "FAIL") row.fail += 1;
    else if (status === "NA") row.na += 1;
    else row.ok += 1;
  }

  const sectionRows = Array.from(sectionSummaryMap.values()).sort(
    (a, b) => b.fail - a.fail || a.section_name.localeCompare(b.section_name)
  );

  const auditCount = audits.length;
  const avgScore =
    auditCount > 0
      ? audits
          .filter((a) => typeof a.score === "number")
          .reduce((sum, a) => sum + (a.score ?? 0), 0) /
        Math.max(
          1,
          audits.filter((a) => typeof a.score === "number").length
        )
      : null;

  const failCount = audits.reduce((sum, a) => sum + a.fail, 0);
  const naCount = audits.reduce((sum, a) => sum + a.na, 0);
  const okCount = audits.reduce((sum, a) => sum + a.ok, 0);
  const totalAnswers = audits.reduce((sum, a) => sum + a.total, 0);
  const failRatePct = totalAnswers > 0 ? (failCount / totalAnswers) * 100 : 0;

  return {
    hotel: {
      id: hotel?.id ?? area.hotel_id ?? null,
      name: hotel?.name ?? "Hotel",
    },
    area: {
      id: area.id,
      name: area.name,
      type: area.type ?? null,
    },
    range: {
      week_start: weekStart,
      week_end: weekEnd,
      label: formatRangeLabel(weekStart, weekEnd),
    },
    summary: {
      audit_count: auditCount,
      avg_score: avgScore,
      fail_rate_pct: failRatePct,
      fail_count: failCount,
      na_count: naCount,
      ok_count: okCount,
      total_answers: totalAnswers,
    },
    audits,
    top_failures,
    sections: sectionRows,
  };
}