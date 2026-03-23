import { NextRequest, NextResponse } from "next/server";

import {
  getDepartmentRedirectTarget,
  getDepartmentRouteScope,
  normalizeDepartmentCode,
  type DepartmentCode,
} from "@/app/(app)/_lib/departmentAccess";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

type ProfileDepartmentRow = {
  assigned_department_id: string | null;
};

type AreaScopeRow = {
  area_id: string | null;
};

type HotelDepartmentRow = {
  code: string | null;
};

type BacklogItemRow = {
  id: string;
  hotel_id: string | null;
  area_id: string | null;
  audit_run_id: string;
  question_id: string;
  owner_department: string | null;
  title: string | null;
  status: string | null;
  resolution_comment: string | null;
  ready_for_reaudit: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type QuestionTextRow = {
  id: string;
  text: string | null;
  owner_department: string | null;
};

type AnswerRow = {
  audit_run_id: string;
  question_id: string;
  answer: string | null;
  result: string | null;
};

type RunRow = {
  id: string;
  hotel_id: string | null;
  area_id: string | null;
  audit_template_id: string | null;
  room_number: string | null;
  score: number | null;
  executed_at: string | null;
};

type AreaRow = {
  id: string;
  name: string | null;
};

type TemplateRow = {
  id: string;
  name: string | null;
};

function parseDepartment(value: string | null): DepartmentCode {
  const normalized = normalizeDepartmentCode(value);
  return normalized === "it" || normalized === "engineering" ? normalized : null;
}

function getOwnerDepartmentValues(department: DepartmentCode) {
  return department === "it" ? ["it", "systems"] : ["engineering"];
}

function buildScopeLabel(routeScope: "department" | "area", isOwnDepartmentView: boolean) {
  if (routeScope === "area") {
    return "Visibilidad limitada a las áreas operativas que tienes asignadas.";
  }

  if (isOwnDepartmentView) {
    return "Visibilidad de tu departamento.";
  }

  return "Visibilidad completa del hotel para este departamento.";
}

function isMissingBacklogTable(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("department_backlog_items") &&
    (normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("relation") ||
      normalized.includes("does not exist"))
  );
}

export async function GET(request: NextRequest) {
  const department = parseDepartment(request.nextUrl.searchParams.get("department"));
  if (!department) return jsonError("Departamento invalido.", 400);

  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const hotelResult = resolveRouteHotelScope(caller.profile, caller.requestedHotelId);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const admin = supabaseAdmin();

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .select("assigned_department_id")
    .eq("id", caller.profile.id)
    .maybeSingle();

  if (profileError) return jsonDbError(profileError);

  const assignedDepartmentId =
    String((profileData as ProfileDepartmentRow | null)?.assigned_department_id ?? "").trim() || null;

  let assignedDepartmentCode: string | null = null;

  if (assignedDepartmentId) {
    const { data: departmentData, error: departmentError } = await admin
      .from("hotel_departments")
      .select("code")
      .eq("id", assignedDepartmentId)
      .maybeSingle();

    if (departmentError) return jsonDbError(departmentError);

    assignedDepartmentCode = normalizeDepartmentCode(
      (departmentData as HotelDepartmentRow | null)?.code ?? null
    );
  }

  const { data: areaScopeData, error: areaScopeError } = await admin
    .from("user_area_access")
    .select("area_id")
    .eq("user_id", caller.profile.id)
    .eq("hotel_id", hotelResult.hotelId);

  if (areaScopeError) return jsonDbError(areaScopeError);

  const allowedAreaIds = Array.from(
    new Set(
      ((areaScopeData ?? []) as AreaScopeRow[])
        .map((row) => String(row.area_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const routeScope = getDepartmentRouteScope(
    department,
    caller.profile.role,
    assignedDepartmentCode,
    allowedAreaIds.length > 0,
  );
  const isOwnDepartmentView = assignedDepartmentCode === department;

  if (routeScope === "none") {
    return NextResponse.json({
      ok: true,
      redirectTo: getDepartmentRedirectTarget(caller.profile.role, assignedDepartmentCode),
      rows: [],
      scopeLabel: "",
      userName: caller.profile.full_name ?? null,
      viewMode: isOwnDepartmentView ? "department" : "global",
      storageMode: "backlog",
      warningMessage: null,
    });
  }

  if (routeScope === "area" && allowedAreaIds.length === 0) {
    return NextResponse.json({
      ok: true,
      redirectTo: null,
      rows: [],
      scopeLabel: buildScopeLabel(routeScope, isOwnDepartmentView),
      userName: caller.profile.full_name ?? null,
      viewMode: isOwnDepartmentView ? "department" : "global",
      storageMode: "backlog",
      warningMessage: null,
    });
  }

  let itemsQuery = admin
    .from("department_backlog_items")
    .select(
      "id,hotel_id,area_id,audit_run_id,question_id,owner_department,title,status,resolution_comment,ready_for_reaudit,created_at,updated_at",
    )
    .eq("hotel_id", hotelResult.hotelId)
    .eq("owner_department", department)
    .order("created_at", { ascending: false })
    .limit(500);

  if (routeScope === "area") {
    itemsQuery = itemsQuery.in("area_id", allowedAreaIds);
  }

  const { data: itemData, error: itemError } = await itemsQuery;
  const shouldUseFallback = !!itemError && isMissingBacklogTable(itemError.message);
  if (itemError && !shouldUseFallback) return jsonDbError(itemError);

  if (!shouldUseFallback) {
    const items = (itemData ?? []) as BacklogItemRow[];

    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        redirectTo: null,
        rows: [],
        scopeLabel: buildScopeLabel(routeScope, isOwnDepartmentView),
        userName: caller.profile.full_name ?? null,
        viewMode: isOwnDepartmentView ? "department" : "global",
        storageMode: "backlog",
        warningMessage: null,
      });
    }

    const runIds = Array.from(new Set(items.map((row) => row.audit_run_id).filter(Boolean)));

    const { data: runData, error: runError } = await admin
      .from("audit_runs")
      .select("id, hotel_id, area_id, audit_template_id, room_number, score, executed_at")
      .in("id", runIds);

    if (runError) return jsonDbError(runError);

    const runs = (runData ?? []) as RunRow[];
    const runMap = new Map(runs.map((row) => [row.id, row]));
    const areaIds = Array.from(new Set(items.map((row) => row.area_id ?? "").filter(Boolean)));
    const templateIds = Array.from(
      new Set(items.map((row) => runMap.get(row.audit_run_id)?.audit_template_id ?? "").filter(Boolean)),
    );

    const [{ data: areaData, error: areaError }, { data: templateData, error: templateError }] =
      await Promise.all([
        areaIds.length > 0
          ? admin.from("areas").select("id, name").in("id", areaIds)
          : Promise.resolve({ data: [] as AreaRow[], error: null }),
        templateIds.length > 0
          ? admin.from("audit_templates").select("id, name").in("id", templateIds)
          : Promise.resolve({ data: [] as TemplateRow[], error: null }),
      ]);

    if (areaError) return jsonDbError(areaError);
    if (templateError) return jsonDbError(templateError);

    const areaMap = new Map(((areaData ?? []) as AreaRow[]).map((row) => [row.id, row.name ?? null]));
    const templateMap = new Map(
      ((templateData ?? []) as TemplateRow[]).map((row) => [row.id, row.name ?? null]),
    );

    const rows = items
      .map((item) => {
        const run = runMap.get(item.audit_run_id);
        if (!run) return null;

        return {
          backlog_item_id: item.id,
          audit_run_id: item.audit_run_id,
          question_id: item.question_id,
          title: item.title ?? "Hallazgo sin texto",
          status: item.status ?? "open",
          department_code: department,
          owner_department: item.owner_department ?? department,
          hotel_id: String(run.hotel_id ?? hotelResult.hotelId),
          area_id: String(run.area_id ?? ""),
          area_name: run.area_id ? areaMap.get(run.area_id) ?? null : null,
          audit_template_id: run.audit_template_id ?? null,
          template_name: run.audit_template_id ? templateMap.get(run.audit_template_id) ?? null : null,
          resolution_comment: item.resolution_comment ?? null,
          ready_for_reaudit: item.ready_for_reaudit ?? false,
          room_number: run.room_number ?? null,
          audit_score: run.score ?? null,
          created_at: item.created_at ?? run.executed_at ?? null,
          updated_at: item.updated_at ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const left = new Date(b?.created_at ?? 0).getTime();
        const right = new Date(a?.created_at ?? 0).getTime();
        return left - right;
      });

    return NextResponse.json({
      ok: true,
      redirectTo: null,
      rows,
      scopeLabel: buildScopeLabel(routeScope, isOwnDepartmentView),
      userName: caller.profile.full_name ?? null,
      viewMode: isOwnDepartmentView ? "department" : "global",
      storageMode: "backlog",
      warningMessage: null,
    });
  }

  const ownerDepartmentValues = getOwnerDepartmentValues(department);
  const { data: questionData, error: questionError } = await admin
    .from("audit_questions")
    .select("id, text, owner_department")
    .in("owner_department", ownerDepartmentValues)
    .eq("active", true);

  if (questionError) return jsonDbError(questionError);

  const questions = (questionData ?? []) as QuestionTextRow[];
  const questionIds = questions.map((row) => row.id);

  if (questionIds.length === 0) {
    return NextResponse.json({
      ok: true,
      redirectTo: null,
      rows: [],
      scopeLabel: buildScopeLabel(routeScope, isOwnDepartmentView),
      userName: caller.profile.full_name ?? null,
      viewMode: isOwnDepartmentView ? "department" : "global",
      storageMode: "fallback",
      warningMessage:
        "Falta aplicar la migración del backlog operativo. Mostrando FAILs reales en modo lectura temporal.",
    });
  }

  const { data: answerData, error: answerError } = await admin
    .from("audit_answers")
    .select("audit_run_id, question_id, answer, result")
    .in("question_id", questionIds)
    .or("answer.eq.FAIL,result.eq.FAIL")
    .limit(1000);

  if (answerError) return jsonDbError(answerError);

  const failAnswers = ((answerData ?? []) as AnswerRow[]).filter((row) => {
    const value = String(row.result ?? row.answer ?? "").trim().toUpperCase();
    return value === "FAIL";
  });

  const runIds = Array.from(new Set(failAnswers.map((row) => row.audit_run_id).filter(Boolean)));
  if (runIds.length === 0) {
    return NextResponse.json({
      ok: true,
      redirectTo: null,
      rows: [],
      scopeLabel: buildScopeLabel(routeScope, isOwnDepartmentView),
      userName: caller.profile.full_name ?? null,
      viewMode: isOwnDepartmentView ? "department" : "global",
      storageMode: "fallback",
      warningMessage:
        "Falta aplicar la migración del backlog operativo. Mostrando FAILs reales en modo lectura temporal.",
    });
  }

  let runsQuery = admin
    .from("audit_runs")
    .select("id, hotel_id, area_id, audit_template_id, room_number, score, executed_at")
    .eq("hotel_id", hotelResult.hotelId)
    .eq("status", "submitted")
    .in("id", runIds);

  if (routeScope === "area") {
    runsQuery = runsQuery.in("area_id", allowedAreaIds);
  }

  const { data: runData, error: runError } = await runsQuery;

  if (runError) return jsonDbError(runError);

  const runs = (runData ?? []) as RunRow[];
  const runMap = new Map(runs.map((row) => [row.id, row]));
  const filteredAnswers = failAnswers.filter((row) => runMap.has(row.audit_run_id));
  const areaIds = Array.from(
    new Set(filteredAnswers.map((row) => runMap.get(row.audit_run_id)?.area_id ?? "").filter(Boolean)),
  );
  const templateIds = Array.from(
    new Set(filteredAnswers.map((row) => runMap.get(row.audit_run_id)?.audit_template_id ?? "").filter(Boolean)),
  );

  const [{ data: areaData, error: areaError }, { data: templateData, error: templateError }] =
    await Promise.all([
      areaIds.length > 0
        ? admin.from("areas").select("id, name").in("id", areaIds)
        : Promise.resolve({ data: [] as AreaRow[], error: null }),
      templateIds.length > 0
        ? admin.from("audit_templates").select("id, name").in("id", templateIds)
        : Promise.resolve({ data: [] as TemplateRow[], error: null }),
    ]);

  if (areaError) return jsonDbError(areaError);
  if (templateError) return jsonDbError(templateError);

  const questionMap = new Map(questions.map((row) => [row.id, row]));
  const areaMap = new Map(((areaData ?? []) as AreaRow[]).map((row) => [row.id, row.name ?? null]));
  const templateMap = new Map(
    ((templateData ?? []) as TemplateRow[]).map((row) => [row.id, row.name ?? null]),
  );

  const rows = filteredAnswers
    .map((answer) => {
      const run = runMap.get(answer.audit_run_id);
      const question = questionMap.get(answer.question_id);
      if (!run || !question) return null;

      return {
        backlog_item_id: `fallback:${answer.audit_run_id}:${answer.question_id}:${department}`,
        audit_run_id: answer.audit_run_id,
        question_id: answer.question_id,
        title: question.text ?? "Hallazgo sin texto",
        status: "open",
        department_code: department,
        owner_department: question.owner_department ?? department,
        hotel_id: String(run.hotel_id ?? hotelResult.hotelId),
        area_id: String(run.area_id ?? ""),
        area_name: run.area_id ? areaMap.get(run.area_id) ?? null : null,
        audit_template_id: run.audit_template_id ?? null,
        template_name: run.audit_template_id ? templateMap.get(run.audit_template_id) ?? null : null,
        resolution_comment: null,
        ready_for_reaudit: false,
        room_number: run.room_number ?? null,
        audit_score: run.score ?? null,
        created_at: run.executed_at ?? null,
        updated_at: null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const left = new Date(b?.created_at ?? 0).getTime();
      const right = new Date(a?.created_at ?? 0).getTime();
      return left - right;
    });

  return NextResponse.json({
    ok: true,
    redirectTo: null,
    rows,
    scopeLabel: buildScopeLabel(routeScope, isOwnDepartmentView),
    userName: caller.profile.full_name ?? null,
    viewMode: isOwnDepartmentView ? "department" : "global",
    storageMode: "fallback",
    warningMessage:
      "Falta aplicar la migración del backlog operativo. Mostrando FAILs reales en modo lectura temporal.",
  });
}
