import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  AnalyticsFiltersState,
  AnalyticsPagePayload,
  AreaByTemplate,
  AreaRow,
  AreaSummaryStats,
  AreaTrendPoint,
  CommonStandardRow,
  HotelRow,
  MemberReport,
  MemberTopStandardRow,
  MemberTrendRow,
  Profile,
  RankingRow,
  TabKey,
  TeamMemberLite,
  TemplateLite,
} from "@/app/(app)/analytics/_lib/analyticsTypes";
import { areaLabel, pct, safeVal } from "@/app/(app)/analytics/_lib/analyticsUtils";

type AuditRunRow = {
  id: string;
  executed_at: string | null;
  team_member_id: string | null;
  area_id: string;
  status: string | null;
  hotel_id: string | null;
  audit_template_id: string | null;
};

type AnswerRowLite = {
  audit_run_id: string;
  question_id: string;
  answer: "PASS" | "FAIL" | "NA" | null;
  result: "PASS" | "FAIL" | "NA" | null;
};

type QuestionLite = {
  id: string;
  text: string;
  tag: string | null;
  classification: string | null;
};

function isValidTab(value: string | null | undefined): value is TabKey {
  return value === "area" || value === "ranking" || value === "common" || value === "member";
}

function normalizePeriod(value: string | null | undefined): AnalyticsFiltersState["period"] {
  return value === "60" || value === "90" || value === "365" || value === "custom" ? value : "30";
}

function isValidDateInput(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function resolvePeriodRange(period: AnalyticsFiltersState["period"], customFrom: string, customTo: string) {
  const fromISO =
    period === "30"
      ? isoDaysAgo(30)
      : period === "60"
      ? isoDaysAgo(60)
      : period === "90"
      ? isoDaysAgo(90)
      : period === "365"
      ? isoDaysAgo(365)
      : isValidDateInput(customFrom)
      ? new Date(`${customFrom}T00:00:00`).toISOString()
      : isoDaysAgo(30);

  const toISO =
    period !== "custom"
      ? new Date().toISOString()
      : isValidDateInput(customTo)
      ? new Date(`${customTo}T23:59:59`).toISOString()
      : new Date().toISOString();

  return { fromISO, toISO };
}

function getISOWeekLabel(dateStr: string): { week_iso: string; week_label: string } {
  const d = new Date(dateStr);
  // Lunes de esa semana
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const dd = String(monday.getDate()).padStart(2, "0");
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const yyyy = monday.getFullYear();
  return {
    week_iso: `${yyyy}-${mm}-${dd}`,
    week_label: `${dd}/${mm}`,
  };
}

function buildAreaStats(args: {
  runs: AuditRunRow[];
  answers: AnswerRowLite[];
  templates: TemplateLite[];
}): AreaSummaryStats {
  const { runs, answers, templates } = args;

  const templateNameById = new Map<string, string>(templates.map((t) => [t.id, t.name]));
  const answeredByRun = new Map<string, { answered: number; fails: number }>();

  for (const answer of answers) {
    const value = (answer.result ?? answer.answer) as "PASS" | "FAIL" | "NA" | null;
    if (value !== "PASS" && value !== "FAIL") continue;
    const current = answeredByRun.get(answer.audit_run_id) ?? { answered: 0, fails: 0 };
    current.answered += 1;
    if (value === "FAIL") current.fails += 1;
    answeredByRun.set(answer.audit_run_id, current);
  }

  let totalAnswered = 0;
  let totalFails = 0;
  let lastAuditAt: string | null = null;

  for (const run of runs) {
    const agg = answeredByRun.get(run.id);
    if (agg) {
      totalAnswered += agg.answered;
      totalFails += agg.fails;
    }
    if (run.executed_at && (!lastAuditAt || run.executed_at > lastAuditAt)) {
      lastAuditAt = run.executed_at;
    }
  }

  // Por template
  const byTemplateMap = new Map<string | null, { audits: number; answered: number; fails: number }>();
  for (const run of runs) {
    const key = run.audit_template_id ?? null;
    const current = byTemplateMap.get(key) ?? { audits: 0, answered: 0, fails: 0 };
    current.audits += 1;
    const agg = answeredByRun.get(run.id);
    if (agg) {
      current.answered += agg.answered;
      current.fails += agg.fails;
    }
    byTemplateMap.set(key, current);
  }

  const by_template: AreaByTemplate[] = Array.from(byTemplateMap.entries())
    .map(([templateId, value]) => ({
      template_id: templateId,
      template_name: templateId ? (templateNameById.get(templateId) ?? "—") : "Sin tipo",
      audits_count: value.audits,
      fail_pct: value.answered ? pct(value.fails, value.answered) : null,
    }))
    .sort((a, b) => b.audits_count - a.audits_count);

  // Tendencia semanal
  const weekMap = new Map<string, { week_label: string; audits: number; answered: number; fails: number }>();
  for (const run of runs) {
    if (!run.executed_at) continue;
    const { week_iso, week_label } = getISOWeekLabel(run.executed_at);
    const current = weekMap.get(week_iso) ?? { week_label, audits: 0, answered: 0, fails: 0 };
    current.audits += 1;
    const agg = answeredByRun.get(run.id);
    if (agg) {
      current.answered += agg.answered;
      current.fails += agg.fails;
    }
    weekMap.set(week_iso, current);
  }

  const trend: AreaTrendPoint[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_iso, value]) => ({
      week_iso,
      week_label: value.week_label,
      audits_count: value.audits,
      fail_pct: value.answered ? pct(value.fails, value.answered) : null,
    }));

  return {
    audits_count: runs.length,
    overall_fail_pct: totalAnswered ? pct(totalFails, totalAnswered) : null,
    last_audit_at: lastAuditAt,
    by_template,
    trend,
  };
}

async function loadAreasForAnalytics(profile: Profile, hotelId: string) {
  const admin = supabaseAdmin();

  if (profile.role === "manager") {
    const { data: accessRows, error: accessError } = await admin
      .from("user_area_access")
      .select("area_id")
      .eq("user_id", profile.id)
      .eq("hotel_id", hotelId);

    if (accessError) {
      throw accessError;
    }

    const allowedIds = Array.from(
      new Set((accessRows ?? []).map((row) => String(row.area_id ?? "")).filter(Boolean))
    );

    if (allowedIds.length === 0) {
      return [] satisfies AreaRow[];
    }

    const { data: areas, error: areasError } = await admin
      .from("areas")
      .select("id,name,type,hotel_id")
      .eq("hotel_id", hotelId)
      .in("id", allowedIds)
      .order("name", { ascending: true });

    if (areasError) {
      throw areasError;
    }

    return (areas ?? []) as AreaRow[];
  }

  const { data: areas, error } = await admin
    .from("areas")
    .select("id,name,type,hotel_id")
    .eq("hotel_id", hotelId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (areas ?? []) as AreaRow[];
}

function buildRanking(args: {
  runs: AuditRunRow[];
  answers: AnswerRowLite[];
  membersById: Map<string, TeamMemberLite>;
  rankingMode: string;
}) {
  const { runs, answers, membersById, rankingMode } = args;
  const runsForRanking =
    rankingMode === "all" ? runs : runs.filter((run) => run.audit_template_id === rankingMode);
  const runIdsForRanking = new Set(runsForRanking.map((run) => run.id));

  const memberByRun = new Map<string, string>();
  const auditsByMember = new Map<string, number>();
  const lastByMember = new Map<string, string>();

  for (const run of runsForRanking) {
    if (!run.team_member_id) continue;
    memberByRun.set(run.id, run.team_member_id);
    auditsByMember.set(run.team_member_id, (auditsByMember.get(run.team_member_id) ?? 0) + 1);

    if (run.executed_at) {
      const previous = lastByMember.get(run.team_member_id);
      if (!previous || new Date(run.executed_at).getTime() > new Date(previous).getTime()) {
        lastByMember.set(run.team_member_id, run.executed_at);
      }
    }
  }

  const answerAgg = new Map<string, { answered: number; fails: number }>();

  for (const answer of answers) {
    if (!runIdsForRanking.has(answer.audit_run_id)) continue;
    const memberId = memberByRun.get(answer.audit_run_id);
    if (!memberId) continue;

    const value = (answer.result ?? answer.answer) as "PASS" | "FAIL" | "NA" | null;
    if (value !== "PASS" && value !== "FAIL" && value !== "NA") continue;
    if (value === "NA") continue;

    const current = answerAgg.get(memberId) ?? { answered: 0, fails: 0 };
    current.answered += 1;
    if (value === "FAIL") current.fails += 1;
    answerAgg.set(memberId, current);
  }

  return Array.from(new Set([...answerAgg.keys(), ...auditsByMember.keys()])).map((memberId) => {
    const member = membersById.get(memberId);
    const value = answerAgg.get(memberId) ?? { answered: 0, fails: 0 };

    return {
      team_member_id: memberId,
      name: member?.full_name ?? "—",
      audits_count: auditsByMember.get(memberId) ?? 0,
      answered: value.answered,
      fails: value.fails,
      fail_rate_pct: value.answered ? pct(value.fails, value.answered) : null,
      last_audit_at: lastByMember.get(memberId) ?? null,
    } satisfies RankingRow;
  });
}

function buildCommonFailures(args: {
  runs: AuditRunRow[];
  answers: AnswerRowLite[];
  questionsById: Map<string, QuestionLite>;
}) {
  const memberByRun = new Map<string, string>();

  for (const run of args.runs) {
    if (run.team_member_id) {
      memberByRun.set(run.id, run.team_member_id);
    }
  }

  const standardAgg = new Map<string, { fail_count: number; members: Set<string> }>();

  for (const answer of args.answers) {
    const memberId = memberByRun.get(answer.audit_run_id);
    if (!memberId) continue;

    const value = (answer.result ?? answer.answer) as "PASS" | "FAIL" | "NA" | null;
    if (value !== "FAIL") continue;

    const question = args.questionsById.get(answer.question_id);
    if (!question) continue;

    const current = standardAgg.get(question.id) ?? { fail_count: 0, members: new Set<string>() };
    current.fail_count += 1;
    current.members.add(memberId);
    standardAgg.set(question.id, current);
  }

  const listAll = Array.from(standardAgg.entries()).map(([questionId, value]) => {
    const question = args.questionsById.get(questionId);

    return {
      question_id: questionId,
      standard: question?.text ?? "—",
      tag: question?.tag ?? null,
      classification: question?.classification ?? null,
      affected_members: value.members.size,
      fail_count: value.fail_count,
    } satisfies CommonStandardRow;
  });

  return {
    commonByPeople: [...listAll]
      .filter((row) => row.affected_members > 1)
      .sort((a, b) =>
        b.affected_members !== a.affected_members
          ? b.affected_members - a.affected_members
          : b.fail_count - a.fail_count
      )
      .slice(0, 30),
    commonByFails: [...listAll]
      .sort((a, b) => (b.fail_count !== a.fail_count ? b.fail_count - a.fail_count : b.affected_members - a.affected_members))
      .slice(0, 30),
  };
}

function buildMemberAnalytics(args: {
  runs: AuditRunRow[];
  answers: AnswerRowLite[];
  templates: TemplateLite[];
  questionsById: Map<string, QuestionLite>;
  selectedMemberId: string;
  memberAuditMode: string;
}) {
  const { runs, answers, templates, questionsById, selectedMemberId, memberAuditMode } = args;

  if (!selectedMemberId) {
    return {
      report: null,
      trend: [] satisfies MemberTrendRow[],
      topStandards: [] satisfies MemberTopStandardRow[],
    };
  }

  const runsMemberAll = runs.filter((run) => run.team_member_id === selectedMemberId);
  const templateNameById = new Map<string, string>(templates.map((template) => [template.id, template.name]));
  const runsMember =
    memberAuditMode === "all"
      ? runsMemberAll
      : runsMemberAll.filter((run) => run.audit_template_id === memberAuditMode);

  if (runsMember.length === 0) {
    return {
      report: {
        audits_count: 0,
        overall_fail_pct: null,
        by_template: [],
      } satisfies MemberReport,
      trend: [] satisfies MemberTrendRow[],
      topStandards: [] satisfies MemberTopStandardRow[],
    };
  }

  const runIdsSelected = new Set(runsMember.map((run) => run.id));
  const answeredByRun = new Map<string, { answered: number; fails: number }>();

  for (const answer of answers) {
    const value = (answer.result ?? answer.answer) as "PASS" | "FAIL" | "NA" | null;
    if (value !== "PASS" && value !== "FAIL" && value !== "NA") continue;
    if (value === "NA") continue;

    const current = answeredByRun.get(answer.audit_run_id) ?? { answered: 0, fails: 0 };
    current.answered += 1;
    if (value === "FAIL") current.fails += 1;
    answeredByRun.set(answer.audit_run_id, current);
  }

  let overallAnswered = 0;
  let overallFails = 0;

  for (const [runId, value] of answeredByRun.entries()) {
    if (!runIdsSelected.has(runId)) continue;
    overallAnswered += value.answered;
    overallFails += value.fails;
  }

  let byTemplate: MemberReport["by_template"] = [];

  if (memberAuditMode === "all") {
    const auditsByTemplate = new Map<string | null, { audits: number; answered: number; fails: number }>();

    for (const run of runsMember) {
      const key = run.audit_template_id ?? null;
      const current = auditsByTemplate.get(key) ?? { audits: 0, answered: 0, fails: 0 };
      current.audits += 1;

      const totals = answeredByRun.get(run.id) ?? { answered: 0, fails: 0 };
      current.answered += totals.answered;
      current.fails += totals.fails;
      auditsByTemplate.set(key, current);
    }

    byTemplate = Array.from(auditsByTemplate.entries())
      .map(([templateId, value]) => ({
        template_id: templateId,
        template_name: templateId ? templateNameById.get(templateId) ?? "—" : "Sin tipo",
        audits_count: value.audits,
        audits_pct: pct(value.audits, runsMember.length),
        fail_pct: value.answered ? pct(value.fails, value.answered) : null,
      }))
      .sort((a, b) => b.audits_count - a.audits_count);
  }

  const trend = runsMember.map((run) => {
    const value = answeredByRun.get(run.id) ?? { answered: 0, fails: 0 };

    return {
      run_id: run.id,
      executed_at: run.executed_at,
      template_name: run.audit_template_id ? templateNameById.get(run.audit_template_id) ?? "—" : "Sin tipo",
      answered: value.answered,
      fails: value.fails,
      fail_pct: value.answered ? pct(value.fails, value.answered) : null,
    } satisfies MemberTrendRow;
  });

  const failAgg = new Map<string, number>();

  for (const answer of answers) {
    if (!runIdsSelected.has(answer.audit_run_id)) continue;
    const value = (answer.result ?? answer.answer) as "PASS" | "FAIL" | "NA" | null;
    if (value !== "FAIL") continue;
    failAgg.set(answer.question_id, (failAgg.get(answer.question_id) ?? 0) + 1);
  }

  const topStandards = Array.from(failAgg.entries())
    .map(([questionId, failCount]) => {
      const question = questionsById.get(questionId);

      return {
        question_id: questionId,
        standard: question?.text ?? "—",
        tag: question?.tag ?? null,
        classification: question?.classification ?? null,
        fail_count: failCount,
      } satisfies MemberTopStandardRow;
    })
    .sort((a, b) => b.fail_count - a.fail_count)
    .slice(0, 20);

  return {
    report: {
      audits_count: runsMember.length,
      overall_fail_pct: overallAnswered ? pct(overallFails, overallAnswered) : null,
      by_template: byTemplate,
    } satisfies MemberReport,
    trend,
    topStandards,
  };
}

export async function buildAnalyticsPagePayload(args: {
  profile: Profile;
  hotelId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<AnalyticsPagePayload> {
  const { profile, hotelId, searchParams } = args;
  const admin = supabaseAdmin();

  const requestedAreaId = typeof searchParams?.areaId === "string" ? searchParams.areaId : "";
  const period = normalizePeriod(typeof searchParams?.period === "string" ? searchParams.period : null);
  const customFrom = typeof searchParams?.from === "string" ? searchParams.from : "";
  const customTo = typeof searchParams?.to === "string" ? searchParams.to : "";
  const requestedRankingMode = typeof searchParams?.rankingMode === "string" ? searchParams.rankingMode : "all";
  const requestedMemberId = typeof searchParams?.memberId === "string" ? searchParams.memberId : "";
  const requestedMemberAuditMode =
    typeof searchParams?.memberAuditMode === "string" ? searchParams.memberAuditMode : "all";
  const tabValue = typeof searchParams?.tab === "string" ? searchParams.tab : "";
  const tab = isValidTab(tabValue) ? tabValue : "area";
  const { fromISO, toISO } = resolvePeriodRange(period, customFrom, customTo);

  const [{ data: hotelData, error: hotelError }, areas] = await Promise.all([
    admin.from("hotels").select("id,name").eq("id", hotelId).maybeSingle(),
    loadAreasForAnalytics(profile, hotelId),
  ]);

  if (hotelError) {
    throw hotelError;
  }

  const hotel = (hotelData as HotelRow | null) ?? null;
  const selectedArea =
    areas.find((area) => area.id === requestedAreaId) ??
    (areas.length > 0 ? areas[0] : null);

  const filtersBase: AnalyticsFiltersState = {
    selectedAreaId: selectedArea?.id ?? "",
    selectedAreaLabel: areaLabel(selectedArea?.name ?? null, selectedArea?.type ?? null),
    period,
    customFrom,
    customTo,
    fromISO,
    toISO,
    rankingMode: "all",
    selectedMemberId: "",
    memberAuditMode: "all",
    tab,
  };

  if (!selectedArea) {
    return {
      hotel,
      areas,
      bootError: "No tienes áreas asignadas para ver analítica. Revisa user_area_access.",
      dataError: null,
      filters: filtersBase,
      templates: [],
      membersForArea: [],
      ranking: [],
      commonByPeople: [],
      commonByFails: [],
      memberReport: null,
      memberTrend: [],
      memberTopStandards: [],
      areaSummary: null,
    };
  }

  const { data: runsData, error: runsError } = await admin
    .from("audit_runs")
    .select("id,executed_at,team_member_id,area_id,status,hotel_id,audit_template_id")
    .eq("hotel_id", hotelId)
    .eq("area_id", selectedArea.id)
    .is("archived_at", null)
    .eq("status", "submitted")
    .gte("executed_at", fromISO)
    .lte("executed_at", toISO)
    .order("executed_at", { ascending: false });

  if (runsError) {
    return {
      hotel,
      areas,
      bootError: null,
      dataError: runsError.message ?? "No se pudo calcular la analítica.",
      filters: filtersBase,
      templates: [],
      membersForArea: [],
      ranking: [],
      commonByPeople: [],
      commonByFails: [],
      memberReport: null,
      memberTrend: [],
      memberTopStandards: [],
      areaSummary: null,
    };
  }

  const runs = (runsData ?? []) as AuditRunRow[];

  if (runs.length === 0) {
    return {
      hotel,
      areas,
      bootError: null,
      dataError: null,
      filters: filtersBase,
      templates: [],
      membersForArea: [],
      ranking: [],
      commonByPeople: [],
      commonByFails: [],
      memberReport: null,
      memberTrend: [],
      memberTopStandards: [],
      areaSummary: null,
    };
  }

  const runIds = runs.map((run) => run.id);
  const templateIds = Array.from(new Set(runs.map((run) => run.audit_template_id).filter(Boolean))) as string[];
  const memberIds = Array.from(new Set(runs.map((run) => run.team_member_id).filter(Boolean))) as string[];

  const [templatesResult, answersResult, membersResult] = await Promise.all([
    templateIds.length > 0
      ? admin
          .from("audit_templates")
          .select("id,name")
          .or(`hotel_id.eq.${hotelId},hotel_id.is.null`)
          .in("id", templateIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("audit_answers").select("audit_run_id,question_id,answer,result").in("audit_run_id", runIds),
    memberIds.length > 0
      ? admin
          .from("team_members")
          .select("id,full_name,position,employee_number")
          .eq("hotel_id", hotelId)
          .in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (templatesResult.error) throw templatesResult.error;
  if (answersResult.error) throw answersResult.error;
  if (membersResult.error) throw membersResult.error;

  const templates = ((templatesResult.data ?? []) as TemplateLite[]).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "es-ES")
  );

  const answers = ((answersResult.data ?? []) as any[]).map((answer) => ({
    audit_run_id: String(answer.audit_run_id),
    question_id: String(answer.question_id),
    answer: safeVal(answer.answer),
    result: safeVal(answer.result),
  })) satisfies AnswerRowLite[];

  const membersForArea = ((membersResult.data ?? []) as TeamMemberLite[]).sort((a, b) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? "", "es-ES", { sensitivity: "base" })
  );

  const questionIds = Array.from(new Set(answers.map((answer) => answer.question_id).filter(Boolean)));
  const { data: questionsData, error: questionsError } =
    questionIds.length > 0
      ? await admin.from("audit_questions").select("id,text,tag,classification").in("id", questionIds)
      : { data: [], error: null };

  if (questionsError) {
    throw questionsError;
  }

  const questionsById = new Map<string, QuestionLite>(
    ((questionsData ?? []) as QuestionLite[]).map((question) => [question.id, question])
  );
  const membersById = new Map<string, TeamMemberLite>(membersForArea.map((member) => [member.id, member]));

  const rankingMode =
    requestedRankingMode === "all" || templates.some((template) => template.id === requestedRankingMode)
      ? requestedRankingMode
      : "all";
  const selectedMemberId =
    membersForArea.some((member) => member.id === requestedMemberId)
      ? requestedMemberId
      : membersForArea[0]?.id ?? "";
  const memberAuditMode =
    requestedMemberAuditMode === "all" || templates.some((template) => template.id === requestedMemberAuditMode)
      ? requestedMemberAuditMode
      : "all";

  const ranking = buildRanking({
    runs,
    answers,
    membersById,
    rankingMode,
  });

  const { commonByPeople, commonByFails } = buildCommonFailures({
    runs,
    answers,
    questionsById,
  });

  const member = buildMemberAnalytics({
    runs: [...runs].sort((a, b) => {
      const aTime = a.executed_at ? new Date(a.executed_at).getTime() : 0;
      const bTime = b.executed_at ? new Date(b.executed_at).getTime() : 0;
      return aTime - bTime;
    }),
    answers,
    templates,
    questionsById,
    selectedMemberId,
    memberAuditMode,
  });

  const areaSummary = buildAreaStats({ runs, answers, templates });

  return {
    hotel,
    areas,
    bootError: null,
    dataError: null,
    filters: {
      ...filtersBase,
      rankingMode,
      selectedMemberId,
      memberAuditMode,
    },
    templates,
    membersForArea,
    ranking,
    commonByPeople,
    commonByFails,
    memberReport: member.report,
    memberTrend: member.trend,
    memberTopStandards: member.topStandards,
    areaSummary,
  };
}
