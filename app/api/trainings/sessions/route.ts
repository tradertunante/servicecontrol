import { NextRequest, NextResponse } from "next/server";

import {
  enforceTrainingAreaScope,
  getTrainingsCaller,
  issueTrainingRegistrationToken,
  loadTrainingSession,
  loadTrainingTopic,
} from "@/lib/trainings/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";

function jsonNoStore(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

    if (!token) {
      return jsonError("token es obligatorio.", 400);
    }

    const admin = supabaseAdmin();
    const { data: topic, error: topicError } = await admin
      .from("training_topics")
      .select("id, hotel_id, title, description, qr_token, is_active")
      .eq("qr_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (topicError) return jsonDbError(topicError);
    if (!topic) return jsonError("Tema no encontrado.", 404);

    const { data: sessions, error: sessionsError } = await admin
      .from("training_sessions")
      .select("id, hotel_id, topic_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
      .eq("topic_id", topic.id)
      .eq("hotel_id", topic.hotel_id)
      .eq("status", "open")
      .order("opened_at", { ascending: false });

    if (sessionsError) return jsonDbError(sessionsError);

    const sessionIds = (sessions ?? []).map((session) => String(session.id));
    const { data: attendances, error: attendancesError } = sessionIds.length
      ? await admin.from("training_attendances").select("session_id").in("session_id", sessionIds)
      : { data: [], error: null };

    if (attendancesError) return jsonDbError(attendancesError);

    const attendanceCountBySession = new Map<string, number>();
    for (const attendance of attendances ?? []) {
      const sessionId = String(attendance.session_id ?? "");
      if (!sessionId) continue;
      attendanceCountBySession.set(sessionId, (attendanceCountBySession.get(sessionId) ?? 0) + 1);
    }

    const serializedSessions = await Promise.all(
      (sessions ?? []).map(async (session) => ({
        id: String(session.id),
        hotel_id: String(session.hotel_id),
        topic_id: String(session.topic_id),
        status: "open" as const,
        opened_at: String(session.opened_at),
        closed_at: session.closed_at ? String(session.closed_at) : null,
        supervisor_name_snapshot: session.supervisor_name_snapshot
          ? String(session.supervisor_name_snapshot)
          : null,
        session_label: session.session_label ? String(session.session_label) : null,
        attendance_count: attendanceCountBySession.get(String(session.id)) ?? 0,
        registration_token: await issueTrainingRegistrationToken(
          String(session.id),
          String(topic.id),
          String(topic.hotel_id)
        ),
      }))
    );

    return jsonNoStore({
      ok: true,
      topic: {
        id: String(topic.id),
        title: String(topic.title ?? "Tema"),
        description: topic.description ? String(topic.description) : null,
        qr_token: String(topic.qr_token),
      },
      sessions: serializedSessions,
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getTrainingsCaller(request, [
      "admin",
      "quality",
      "manager",
      "general_manager",
    ]);

    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await request.json().catch(() => null);
    const topicId = String(body?.topic_id ?? "").trim();
    const sessionLabel =
      body?.session_label == null ? null : String(body.session_label).trim() || null;

    if (!topicId) return jsonError("topic_id es obligatorio.", 400);

    const topic = await loadTrainingTopic(topicId);
    if (!topic || topic.is_active === false) {
      return jsonError("Tema no encontrado.", 404);
    }

    if (String(topic.hotel_id ?? "") !== caller.caller.hotelId) {
      return jsonError("Forbidden: tema fuera de tu hotel.", 403);
    }

    const areaScope = await enforceTrainingAreaScope(
      caller.caller.profile,
      caller.caller.hotelId,
      (topic.area_id as string | null) ?? null
    );
    if (!areaScope.ok) return jsonError(areaScope.error, areaScope.status);

    const admin = supabaseAdmin();
    const { data: existingOpenSession, error: existingOpenSessionError } = await admin
      .from("training_sessions")
      .select("id")
      .eq("topic_id", topicId)
      .eq("hotel_id", caller.caller.hotelId)
      .eq("status", "open")
      .maybeSingle();

    if (existingOpenSessionError) return jsonDbError(existingOpenSessionError);
    if (existingOpenSession?.id) {
      return jsonError("Ya existe una sesion abierta para este tema.", 409);
    }

    const { data, error } = await admin
      .from("training_sessions")
      .insert({
        hotel_id: caller.caller.hotelId,
        topic_id: topicId,
        status: "open",
        opened_by_profile_id: caller.caller.profile.id,
        supervisor_name_snapshot: caller.caller.profile.full_name ?? null,
        session_label: sessionLabel,
      })
      .select("id")
      .maybeSingle();

    if (error) return jsonDbError(error);

    return NextResponse.json({ ok: true, session_id: data?.id ?? null });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await getTrainingsCaller(request, [
      "admin",
      "quality",
      "manager",
      "general_manager",
    ]);

    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();

    if (!sessionId) return jsonError("session_id es obligatorio.", 400);

    const session = await loadTrainingSession(sessionId);
    if (!session) return jsonError("Sesion no encontrada.", 404);

    if (String(session.hotel_id ?? "") !== caller.caller.hotelId) {
      return jsonError("Forbidden: sesion fuera de tu hotel.", 403);
    }

    const topic = await loadTrainingTopic(String(session.topic_id ?? ""));
    if (!topic) return jsonError("Tema no encontrado.", 404);

    const areaScope = await enforceTrainingAreaScope(
      caller.caller.profile,
      caller.caller.hotelId,
      (topic.area_id as string | null) ?? null
    );
    if (!areaScope.ok) return jsonError(areaScope.error, areaScope.status);

    if (String(session.status ?? "") !== "open") {
      return jsonError("La sesion ya esta cerrada.", 409);
    }

    const { error } = await supabaseAdmin()
      .from("training_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by_profile_id: caller.caller.profile.id,
      })
      .eq("id", sessionId)
      .eq("hotel_id", caller.caller.hotelId)
      .eq("status", "open");

    if (error) return jsonDbError(error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getTrainingsCaller(request, [
      "admin",
      "quality",
      "manager",
      "general_manager",
    ]);

    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();

    if (!sessionId) return jsonError("session_id es obligatorio.", 400);

    const session = await loadTrainingSession(sessionId);
    if (!session) return jsonError("Sesion no encontrada.", 404);

    if (String(session.hotel_id ?? "") !== caller.caller.hotelId) {
      return jsonError("Forbidden: sesion fuera de tu hotel.", 403);
    }

    const topic = await loadTrainingTopic(String(session.topic_id ?? ""));
    if (!topic) return jsonError("Tema no encontrado.", 404);

    const areaScope = await enforceTrainingAreaScope(
      caller.caller.profile,
      caller.caller.hotelId,
      (topic.area_id as string | null) ?? null
    );
    if (!areaScope.ok) return jsonError(areaScope.error, areaScope.status);

    if (String(session.status ?? "") !== "closed") {
      return jsonError("Solo puedes eliminar sesiones cerradas.", 409);
    }

    const admin = supabaseAdmin();
    const { error: attendancesError } = await admin
      .from("training_attendances")
      .delete()
      .eq("session_id", sessionId)
      .eq("hotel_id", caller.caller.hotelId);

    if (attendancesError) return jsonDbError(attendancesError);

    const { error: tokensError } = await admin
      .from("training_registration_tokens")
      .delete()
      .eq("session_id", sessionId)
      .eq("hotel_id", caller.caller.hotelId);

    if (tokensError) return jsonDbError(tokensError);

    const { error: sessionDeleteError } = await admin
      .from("training_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("hotel_id", caller.caller.hotelId)
      .eq("status", "closed");

    if (sessionDeleteError) return jsonDbError(sessionDeleteError);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
