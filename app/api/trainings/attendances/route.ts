import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeEmployeeNumber(input: unknown) {
  return String(input ?? "").trim();
}

function getSupabaseRuntimeInfo() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unknown";
  const host =
    rawUrl === "unknown"
      ? "unknown"
      : (() => {
          try {
            return new URL(rawUrl).host;
          } catch {
            return rawUrl.replace("https://", "").replace("http://", "");
          }
        })();
  const projectRef =
    host === "unknown" ? "unknown" : host.replace(".supabase.co", "").split(".")[0] ?? "unknown";

  return {
    urlHost: host,
    projectRef,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? "local",
    runtime: "route-handler-service-role",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();
    const employeeNumber = normalizeEmployeeNumber(body?.employee_number);
    const employeeNameInput =
      body?.employee_name_input == null ? null : String(body.employee_name_input).trim() || null;

    if (!sessionId) {
      return jsonError("session_id es obligatorio.");
    }

    if (!employeeNumber) {
      return jsonError("employee_number es obligatorio.");
    }

    const admin = supabaseAdmin();
    const runtimeInfo = getSupabaseRuntimeInfo();
    console.log("TRAINING_ATTENDANCE_RUNTIME", runtimeInfo);

    const { data: session, error: sessionError } = await admin
      .from("training_sessions")
      .select("id, hotel_id, topic_id, status, training_topics(area_id)")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return jsonError(sessionError.message, 500);
    }

    if (!session) {
      return jsonError("Sesion no encontrada.", 404);
    }

    if (session.status !== "open") {
      return jsonError("La sesion ya no esta abierta.", 409);
    }

    const topicAreaId = String((session as any)?.training_topics?.area_id ?? "").trim() || null;

    const { data: member, error: memberError } = await admin
      .from("team_members")
      .select("id, full_name, employee_number")
      .eq("employee_number", employeeNumber)
      .maybeSingle();

    if (memberError) {
      return jsonError(memberError.message, 500);
    }

    const resolvedMember = member ?? null;

    if (resolvedMember && topicAreaId) {
      const { data: areaLink, error: areaLinkError } = await admin
        .from("team_member_areas")
        .select("team_member_id")
        .eq("team_member_id", resolvedMember.id)
        .eq("area_id", topicAreaId)
        .maybeSingle();

      if (areaLinkError) {
        return jsonError(areaLinkError.message, 500);
      }

      if (!areaLink) {
        return jsonError("El colaborador no pertenece al area de esta formacion.", 409);
      }
    }

    const schemaProbe = await admin
      .from("training_attendances")
      .select("team_member_id", { head: true, count: "exact" })
      .limit(1);

    console.log("TRAINING_SCHEMA_PROBE", {
      error: schemaProbe.error
        ? {
            code: schemaProbe.error.code ?? null,
            message: schemaProbe.error.message,
            details: schemaProbe.error.details ?? null,
            hint: schemaProbe.error.hint ?? null,
          }
        : null,
      count: schemaProbe.count ?? null,
    });

    console.log("TRAINING_ATTENDANCE_INSERT_PAYLOAD", {
      session_id: session.id,
      team_member_id: resolvedMember?.id ?? null,
      employee_number: employeeNumber,
      employee_name_input: employeeNameInput,
    });

    const { error: insertError } = await admin.from("training_attendances").insert({
      hotel_id: session.hotel_id,
      topic_id: session.topic_id,
      session_id: session.id,
      team_member_id: resolvedMember?.id ?? null,
      employee_number: employeeNumber,
      employee_name_input: employeeNameInput,
    });

    if (insertError) {
      console.error("TRAINING_ATTENDANCE_INSERT_ERROR", {
        code: insertError.code ?? null,
        message: insertError.message,
        details: insertError.details ?? null,
        hint: insertError.hint ?? null,
        runtime: runtimeInfo,
        payload: {
          session_id: session.id,
          team_member_id: resolvedMember?.id ?? null,
          employee_number: employeeNumber,
          employee_name_input: employeeNameInput,
        },
      });

      if (insertError.code === "23505") {
        return jsonError("La asistencia ya estaba registrada para esta sesion.", 409);
      }

      return jsonError(insertError.message, 500);
    }
    return NextResponse.json({
      ok: true,
      attendance: {
        session_id: session.id,
        team_member_id: resolvedMember?.id ?? null,
        employee_number: employeeNumber,
        employee_name_input: employeeNameInput,
        employee_name_snapshot: resolvedMember?.full_name ?? null,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
