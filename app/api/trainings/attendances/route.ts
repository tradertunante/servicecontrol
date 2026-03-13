import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeEmployeeNumber(input: unknown) {
  return String(input ?? "").trim();
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
    const { data: session, error: sessionError } = await admin
      .from("training_sessions")
      .select("id, hotel_id, topic_id, status")
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

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, active, employee_number")
      .eq("hotel_id", session.hotel_id)
      .eq("employee_number", employeeNumber)
      .maybeSingle();

    if (profileError) {
      return jsonError(profileError.message, 500);
    }

    if (!profile || profile.active === false) {
      return jsonError("Numero de empleado no encontrado.", 404);
    }

    const { error: insertError } = await admin.from("training_attendances").insert({
      hotel_id: session.hotel_id,
      topic_id: session.topic_id,
      session_id: session.id,
      employee_profile_id: profile.id,
      employee_number: employeeNumber,
      employee_name_input: employeeNameInput,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonError("La asistencia ya estaba registrada para esta sesion.", 409);
      }

      return jsonError(insertError.message, 500);
    }

    return NextResponse.json({
      ok: true,
      attendance: {
        session_id: session.id,
        employee_profile_id: profile.id,
        employee_number: employeeNumber,
        employee_name_input: employeeNameInput,
        employee_name_snapshot: profile.full_name ?? null,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
