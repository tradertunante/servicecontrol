import { NextRequest, NextResponse } from "next/server";

import { getTrainingsCaller, getTrainingsVisibleAreaIds } from "@/lib/trainings/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonNoStore(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getTrainingsCaller(request, [
      "admin",
      "quality",
      "manager",
      "general_manager",
    ]);

    if (!caller.ok) return jsonError(caller.error, caller.status);

    const admin = supabaseAdmin();
    const sessionId = request.nextUrl.searchParams.get("session_id")?.trim() ?? "";
    const visibleAreaIds = await getTrainingsVisibleAreaIds(
      caller.caller.profile,
      caller.caller.hotelId
    );

    if (sessionId) {
      const { data: session, error: sessionError } = await admin
        .from("training_sessions")
        .select("id, topic_id, hotel_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
        .eq("id", sessionId)
        .eq("hotel_id", caller.caller.hotelId)
        .eq("status", "closed")
        .maybeSingle();

      if (sessionError) return jsonError(sessionError.message, 500);
      if (!session) return jsonError("Sesion historica no encontrada.", 404);

      const { data: topic, error: topicError } = await admin
        .from("training_topics")
        .select("id, title, is_active, area_id")
        .eq("id", session.topic_id)
        .eq("hotel_id", caller.caller.hotelId)
        .maybeSingle();

      if (topicError) return jsonError(topicError.message, 500);
      if (!topic || topic.is_active === false) {
        return jsonError("Sesion historica no disponible.", 404);
      }

      if (
        caller.caller.profile.role === "manager" &&
        !visibleAreaIds.includes(String(topic.area_id ?? ""))
      ) {
        return jsonError("Forbidden: sesion fuera de tus areas.", 403);
      }

      const { data: attendances, error: attendancesError } = await admin
        .from("training_attendances")
        .select("id, team_member_id, employee_name_input, employee_number, checked_in_at")
        .eq("session_id", session.id)
        .order("checked_in_at", { ascending: false });

      if (attendancesError) return jsonError(attendancesError.message, 500);

      const memberIds = Array.from(
        new Set(
          (attendances ?? [])
            .map((attendance) => String(attendance.team_member_id ?? ""))
            .filter(Boolean)
        )
      );

      const { data: members, error: membersError } = memberIds.length
        ? await admin
            .from("team_members")
            .select("id, full_name")
            .eq("hotel_id", caller.caller.hotelId)
            .in("id", memberIds)
        : { data: [], error: null };

      if (membersError) return jsonError(membersError.message, 500);

      const memberNameById = new Map<string, string | null>();
      for (const member of members ?? []) {
        memberNameById.set(String(member.id), (member.full_name as string | null) ?? null);
      }

      return jsonNoStore({
        ok: true,
        session: {
          id: session.id,
          topic_id: session.topic_id,
          topic_title: topic.title ?? "Tema",
          hotel_id: session.hotel_id,
          opened_at: session.opened_at,
          closed_at: session.closed_at,
          supervisor_name_snapshot: session.supervisor_name_snapshot ?? null,
          session_label: session.session_label ?? null,
          attendance_count: (attendances ?? []).length,
        },
        attendances: (attendances ?? []).map((attendance) => ({
          id: attendance.id,
          team_member_id: attendance.team_member_id,
          employee_name_input: attendance.employee_name_input ?? null,
          employee_number: attendance.employee_number,
          checked_in_at: attendance.checked_in_at,
          validated_member_name: memberNameById.get(String(attendance.team_member_id)) ?? null,
        })),
      });
    }

    const { data: sessions, error: sessionsError } = await admin
      .from("training_sessions")
      .select("id, topic_id, hotel_id, opened_at, closed_at, supervisor_name_snapshot, session_label")
      .eq("hotel_id", caller.caller.hotelId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false });

    if (sessionsError) return jsonError(sessionsError.message, 500);

    const topicIds = Array.from(
      new Set((sessions ?? []).map((session) => String(session.topic_id ?? "")).filter(Boolean))
    );

    const { data: topics, error: topicsError } = topicIds.length
      ? await admin
          .from("training_topics")
          .select("id, title, is_active, area_id")
          .in("id", topicIds)
      : { data: [], error: null };

    if (topicsError) return jsonError(topicsError.message, 500);

    const topicTitleById = new Map<string, string>();
    const topicAreaById = new Map<string, string | null>();

    for (const topic of topics ?? []) {
      if (topic.is_active === false) continue;
      topicTitleById.set(String(topic.id), String(topic.title ?? "Tema"));
      topicAreaById.set(String(topic.id), topic.area_id ? String(topic.area_id) : null);
    }

    const visibleSessions = (sessions ?? []).filter((session) => {
      const topicId = String(session.topic_id ?? "");
      if (!topicTitleById.has(topicId)) return false;
      if (caller.caller.profile.role !== "manager") return true;
      return visibleAreaIds.includes(String(topicAreaById.get(topicId) ?? ""));
    });

    const sessionIds = visibleSessions.map((session) => String(session.id ?? "")).filter(Boolean);
    const { data: attendances, error: attendancesError } = sessionIds.length
      ? await admin.from("training_attendances").select("session_id").in("session_id", sessionIds)
      : { data: [], error: null };

    if (attendancesError) return jsonError(attendancesError.message, 500);

    const attendanceCountBySession = new Map<string, number>();
    for (const attendance of attendances ?? []) {
      const key = String(attendance.session_id ?? "");
      if (!key) continue;
      attendanceCountBySession.set(key, (attendanceCountBySession.get(key) ?? 0) + 1);
    }

    return jsonNoStore({
      ok: true,
      sessions: visibleSessions.map((session) => ({
        id: session.id,
        topic_id: session.topic_id,
        topic_title: topicTitleById.get(String(session.topic_id)) ?? "Tema",
        hotel_id: session.hotel_id,
        opened_at: session.opened_at,
        closed_at: session.closed_at,
        supervisor_name_snapshot: session.supervisor_name_snapshot ?? null,
        session_label: session.session_label ?? null,
        attendance_count: attendanceCountBySession.get(String(session.id)) ?? 0,
      })),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
