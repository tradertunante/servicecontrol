import { NextRequest, NextResponse } from "next/server";

import { consumeTrainingRegistrationToken } from "@/lib/trainings/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

function normalizeEmployeeNumber(input: unknown) {
  return String(input ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();
    const registrationToken = String(body?.registration_token ?? "").trim();
    const employeeNumber = normalizeEmployeeNumber(body?.employee_number);
    const employeeNameInput =
      body?.employee_name_input == null ? null : String(body.employee_name_input).trim() || null;

    if (!sessionId) return jsonError("session_id es obligatorio.");
    if (!registrationToken) return jsonError("registration_token es obligatorio.", 401);
    if (!employeeNumber) return jsonError("employee_number es obligatorio.");

    const admin = supabaseAdmin();
    const { data: session, error: sessionError } = await admin
      .from("training_sessions")
      .select("id, hotel_id, topic_id, status, training_topics(area_id)")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) return jsonDbError(sessionError);
    if (!session) return jsonError("Sesion no encontrada.", 404);
    if (session.status !== "open") return jsonError("La sesion ya no esta abierta.", 409);

    const tokenResult = await consumeTrainingRegistrationToken(registrationToken, {
      sessionId: String(session.id),
      topicId: String(session.topic_id),
      hotelId: String(session.hotel_id),
    });

    if (!tokenResult.ok) {
      return jsonError(tokenResult.error, tokenResult.status);
    }

    const topicAreaId = String((session as any)?.training_topics?.area_id ?? "").trim() || null;

    const { data: member, error: memberError } = await admin
      .from("team_members")
      .select("id, full_name, employee_number")
      .eq("hotel_id", String(session.hotel_id))
      .eq("employee_number", employeeNumber)
      .maybeSingle();

    if (memberError) return jsonDbError(memberError);

    const resolvedMember = member ?? null;

    if (resolvedMember && topicAreaId) {
      const { data: areaLink, error: areaLinkError } = await admin
        .from("team_member_areas")
        .select("team_member_id")
        .eq("team_member_id", resolvedMember.id)
        .eq("area_id", topicAreaId)
        .maybeSingle();

      if (areaLinkError) return jsonDbError(areaLinkError);
      if (!areaLink) {
        return jsonError("El colaborador no pertenece al area de esta formacion.", 409);
      }
    }

    const { error: insertError } = await admin.from("training_attendances").insert({
      hotel_id: session.hotel_id,
      topic_id: session.topic_id,
      session_id: session.id,
      team_member_id: resolvedMember?.id ?? null,
      employee_number: employeeNumber,
      employee_name_input: employeeNameInput,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonError("La asistencia ya estaba registrada para esta sesion.", 409);
      }

      return jsonDbError(insertError);
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
