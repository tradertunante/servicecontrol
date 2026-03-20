import { NextRequest, NextResponse } from "next/server";

import {
  getDepartmentRedirectTarget,
  getDepartmentRouteScope,
  normalizeDepartmentCode,
  type DepartmentCode,
} from "@/app/(app)/_lib/departmentAccess";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileDepartmentRow = {
  assigned_department_id: string | null;
};

type AreaScopeRow = {
  area_id: string | null;
};

type HotelDepartmentRow = {
  code: string | null;
};

type QuestionRow = {
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function parseDepartment(value: string | null): DepartmentCode {
  const normalized = normalizeDepartmentCode(value);
  return normalized === "it" || normalized === "engineering" ? normalized : null;
}

function getOwnerDepartmentValues(department: Exclude<DepartmentCode, null>) {
  return department === "it" ? ["it", "systems"] : ["engineering"];
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

  if (profileError) return jsonError(profileError.message, 500);

  const assignedDepartmentId =
    String((profileData as ProfileDepartmentRow | null)?.assigned_department_id ?? "").trim() || null;

  let assignedDepartmentCode: string | null = null;

  if (assignedDepartmentId) {
    const { data: departmentData, error: departmentError } = await admin
      .from("hotel_departments")
      .select("code")
      .eq("id", assignedDepartmentId)
      .maybeSingle();

    if (departmentError) return jsonError(departmentError.message, 500);

    assignedDepartmentCode = normalizeDepartmentCode(
      (departmentData as HotelDepartmentRow | null)?.code ?? null
    );
  }

  const { data: areaScopeData, error: areaScopeError } = await admin
    .from("user_area_access")
    .select("area_id")
    .eq("user_id", caller.profile.id)
    .eq("hotel_id", hotelResult.hotelId);

  if (areaScopeError) return jsonError(areaScopeError.message, 500);

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

  if (routeScope === "none") {
    return NextResponse.json({
      ok: true,
      redirectTo: getDepartmentRedirectTarget(caller.profile.role, assignedDepartmentCode),
      rows: [],
      scopeLabel: "",
      userName: caller.profile.full_name ?? null,
    });
  }

  if (routeScope === "area" && allowedAreaIds.length === 0) {
    return NextResponse.json({
      ok: true,
      redirectTo: null,
      rows: [],
      scopeLabel: "Visibilidad limitada a las areas operativas que tienes asignadas.",
      userName: caller.profile.full_name ?? null,
    });
  }

  const ownerDepartmentValues = getOwnerDepartmentValues(department);

  const { data: questionData, error: questionError } = await admin
    .from("audit_questions")
    .select("id, text, owner_department")
    .in("owner_department", ownerDepartmentValues)
    .eq("active", true);

  if (questionError) return jsonError(questionError.message, 500);

  const questions = (questionData ?? []) as QuestionRow[];
  const questionIds = questions.map((row) => row.id);

  if (questionIds.length === 0) {
    return NextResponse.json({
      ok: true,
      redirectTo: null,
      rows: [],
      scopeLabel:
        routeScope === "department"
          ? "Visibilidad completa de tu departamento."
          : "Visibilidad limitada a las areas operativas que tienes asignadas.",
      userName: caller.profile.full_name ?? null,
    });
  }

  const { data: answerData, error: answerError } = await admin
    .from("audit_answers")
    .select("audit_run_id, question_id, answer, result")
    .in("question_id", questionIds)
    .or("answer.eq.FAIL,result.eq.FAIL");

  if (answerError) return jsonError(answerError.message, 500);

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
      scopeLabel:
        routeScope === "department"
          ? "Visibilidad completa de tu departamento."
          : "Visibilidad limitada a las areas operativas que tienes asignadas.",
      userName: caller.profile.full_name ?? null,
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
  if (runError) return jsonError(runError.message, 500);

  const runs = (runData ?? []) as RunRow[];
  const runMap = new Map(runs.map((row) => [row.id, row]));
  const filteredAnswers = failAnswers.filter((row) => runMap.has(row.audit_run_id));

  const areaIds = Array.from(
    new Set(filteredAnswers.map((row) => runMap.get(row.audit_run_id)?.area_id ?? "").filter(Boolean)),
  );
  const templateIds = Array.from(
    new Set(
      filteredAnswers.map((row) => runMap.get(row.audit_run_id)?.audit_template_id ?? "").filter(Boolean),
    ),
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

  if (areaError) return jsonError(areaError.message, 500);
  if (templateError) return jsonError(templateError.message, 500);

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
        corrective_action_id: `${answer.audit_run_id}:${answer.question_id}`,
        audit_run_id: answer.audit_run_id,
        question_id: answer.question_id,
        title: question.text ?? "Hallazgo sin texto",
        status: "open",
        assigned_department_id: null,
        assigned_department: department,
        department_code: department,
        owner_department: question.owner_department ?? department,
        hotel_id: String(run.hotel_id ?? hotelResult.hotelId),
        area_id: String(run.area_id ?? ""),
        area_name: run.area_id ? areaMap.get(run.area_id) ?? null : null,
        audit_template_id: run.audit_template_id ?? null,
        template_name: run.audit_template_id ? templateMap.get(run.audit_template_id) ?? null : null,
        room_number: run.room_number ?? null,
        audit_score: run.score ?? null,
        created_at: run.executed_at ?? null,
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
    scopeLabel:
      routeScope === "department"
        ? "Visibilidad completa de tu departamento."
        : "Visibilidad limitada a las areas operativas que tienes asignadas.",
    userName: caller.profile.full_name ?? null,
  });
}
