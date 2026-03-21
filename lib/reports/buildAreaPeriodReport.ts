import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  AreaPeriodAuditRow,
  AreaPeriodReportData,
  AreaPeriodSectionRow,
  AreaPeriodTopFailureRow,
} from "./areaPeriodReportTypes";

type AuditRunRow = {
  id: string;
  area_id: string;
  audit_template_id: string;
  score: number | null;
  status: string | null;
  executed_at: string | null;
  executed_by: string | null;
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

type AnswerRow = {
  audit_run_id: string;
  question_id: string;
  result: string | null;
  answer: string | null;
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

export async function buildAreaPeriodReport(args: {
  areaId: string;
  hotelId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
}): Promise<AreaPeriodReportData> {
  const { areaId, hotelId, startDate, endDate, rangeLabel } = args;
  const admin = supabaseAdmin();

  const endExclusive = new Date(`${endDate}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const endExclusiveStr = endExclusive.toISOString().slice(0, 10);

  const { data: areaData, error: areaErr } = await admin
    .from("areas")
    .select("id,name,type,hotel_id")
    .eq("id", areaId)
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (areaErr) throw areaErr;
  if (!areaData) {
    throw new Error(`No se encontró el área con id ${areaId}.`);
  }

  const area = areaData as AreaRow;

  let hotel: HotelRow | null = null;
  if (area.hotel_id) {
    const { data: hotelData, error: hotelErr } = await admin
      .from("hotels")
      .select("id,name")
      .eq("id", area.hotel_id)
      .maybeSingle();

    if (hotelErr) throw hotelErr;
    hotel = (hotelData as HotelRow | null) ?? null;
  }

  const { data: runData, error: runErr } = await admin
    .from("audit_runs")
    .select("id,area_id,audit_template_id,score,status,executed_at,executed_by")
    .eq("area_id", areaId)
    .eq("hotel_id", hotelId)
    .eq("status", "submitted")
    .gte("executed_at", `${startDate}T00:00:00`)
    .lt("executed_at", `${endExclusiveStr}T00:00:00`)
    .order("executed_at", { ascending: true });

  if (runErr) throw runErr;

  const runs = (runData ?? []) as AuditRunRow[];
  const runIds = runs.map((r) => r.id);
  const templateIds = Array.from(new Set(runs.map((r) => r.audit_template_id).filter(Boolean)));

  let templates: TemplateRow[] = [];
  if (templateIds.length > 0) {
    const { data, error } = await admin
      .from("audit_templates")
      .select("id,name")
      .in("id", templateIds);

    if (error) throw error;
    templates = (data ?? []) as TemplateRow[];
  }

  let answers: AnswerRow[] = [];
  if (runIds.length > 0) {
    const { data, error } = await admin
      .from("audit_answers")
      .select("audit_run_id,question_id,result,answer")
      .in("audit_run_id", runIds);

    if (error) throw error;
    answers = (data ?? []) as AnswerRow[];
  }

  const questionIds = Array.from(new Set(answers.map((a) => a.question_id).filter(Boolean)));

  let questions: QuestionRow[] = [];
  if (questionIds.length > 0) {
    const { data, error } = await admin
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
    const { data, error } = await admin
      .from("audit_sections")
      .select("id,name")
      .in("id", sectionIds);

    if (error) throw error;
    sections = (data ?? []) as SectionRow[];
  }

  const auditorIds = Array.from(new Set(runs.map((r) => r.executed_by).filter((x): x is string => !!x)));
  let auditorNameById = new Map<string, string>();
  if (auditorIds.length > 0) {
    const { data: profileData } = await admin
      .from("profiles")
      .select("id,full_name")
      .in("id", auditorIds);
    auditorNameById = new Map(
      (profileData ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ""])
    );
  }

  const templateById = new Map<string, string>(templates.map((t) => [t.id, t.name]));
  const questionById = new Map<string, QuestionRow>(questions.map((q) => [q.id, q]));
  const sectionNameById = new Map<string, string>(sections.map((s) => [s.id, s.name]));

  const answersByRunId = new Map<string, AnswerRow[]>();
  for (const answer of answers) {
    if (!answersByRunId.has(answer.audit_run_id)) {
      answersByRunId.set(answer.audit_run_id, []);
    }
    answersByRunId.get(answer.audit_run_id)!.push(answer);
  }

  const audits: AreaPeriodAuditRow[] = runs.map((run) => {
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
      auditor_name: run.executed_by ? (auditorNameById.get(run.executed_by) || null) : null,
      score: run.score,
      status: run.status,
      fail,
      na,
      ok,
      total: runAnswers.length,
    };
  });

  const topFailureMap = new Map<string, AreaPeriodTopFailureRow>();
  for (const answer of answers) {
    const status = normalizeStatus(answer);
    if (status !== "FAIL") continue;

    const question = questionById.get(answer.question_id);
    if (!question) continue;

    const sectionName =
      question.audit_section_id
        ? sectionNameById.get(question.audit_section_id) ?? "Sin sección"
        : "Sin sección";

    if (!topFailureMap.has(question.id)) {
      topFailureMap.set(question.id, {
        question_id: question.id,
        question_text: question.text,
        section_name: sectionName,
        fail_count: 0,
      });
    }

    topFailureMap.get(question.id)!.fail_count += 1;
  }

  const top_failures = Array.from(topFailureMap.values())
    .sort((a, b) => b.fail_count - a.fail_count || a.question_text.localeCompare(b.question_text))
    .slice(0, 5);

  const sectionSummaryMap = new Map<string, AreaPeriodSectionRow>();
  for (const answer of answers) {
    const question = questionById.get(answer.question_id);

    const sectionName =
      question?.audit_section_id
        ? sectionNameById.get(question.audit_section_id) ?? "Sin sección"
        : "Sin sección";

    const normalizedSectionName = sectionName.trim() || "Sin sección";
    const sectionKey = normalizedSectionName.toLowerCase();

    if (!sectionSummaryMap.has(sectionKey)) {
      sectionSummaryMap.set(sectionKey, {
        section_id: sectionKey,
        section_name: normalizedSectionName,
        fail: 0,
        na: 0,
        ok: 0,
        total: 0,
      });
    }

    const row = sectionSummaryMap.get(sectionKey)!;
    const status = normalizeStatus(answer);

    row.total += 1;
    if (status === "FAIL") row.fail += 1;
    else if (status === "NA") row.na += 1;
    else row.ok += 1;
  }

  const sectionRows = Array.from(sectionSummaryMap.values()).sort(
    (a, b) => b.fail - a.fail || a.section_name.localeCompare(b.section_name)
  );

  const scoredAudits = audits.filter((a) => typeof a.score === "number");
  const auditCount = audits.length;
  const avgScore =
    scoredAudits.length > 0
      ? scoredAudits.reduce((sum, a) => sum + (a.score ?? 0), 0) / scoredAudits.length
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
      start: startDate,
      end: endDate,
      label: rangeLabel,
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
