import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getTrainingsCaller,
  getTrainingsVisibleAreaIds,
  type TrainingRole,
} from "@/lib/trainings/server";

import { jsonError } from "@/lib/api/response";

const TRAINING_ALLOWED_ROLES: TrainingRole[] = [
  "admin",
  "quality",
  "manager",
  "general_manager",
];

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const callerResult = await getTrainingsCaller(request, TRAINING_ALLOWED_ROLES);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const admin = supabaseAdmin();
    const allowedAreaIds = await getTrainingsVisibleAreaIds(
      callerResult.caller.profile,
      callerResult.caller.hotelId
    );

    if (allowedAreaIds.length === 0) {
      return jsonNoStore({ ok: true, topics: [], available_areas: [] });
    }

    const { data: topics, error: topicsError } = await admin
      .from("training_topics")
      .select("id, hotel_id, area_id, title, description, qr_token, is_active, created_at")
      .eq("hotel_id", callerResult.caller.hotelId)
      .eq("is_active", true)
      .in("area_id", allowedAreaIds)
      .order("created_at", { ascending: false });

    if (topicsError) {
      return jsonError(topicsError.message, 500);
    }

    const areaIds = Array.from(
      new Set((topics ?? []).map((topic) => String(topic.area_id ?? "")).filter(Boolean))
    );
    const { data: areas, error: areasError } = areaIds.length
      ? await admin.from("areas").select("id, name").in("id", areaIds)
      : { data: [], error: null };

    if (areasError) {
      return jsonError(areasError.message, 500);
    }

    const areaNameById = new Map<string, string>();
    for (const area of areas ?? []) {
      areaNameById.set(String(area.id), String(area.name ?? "Area"));
    }

    const topicIds = (topics ?? []).map((topic) => topic.id as string);
    const { data: sessions, error: sessionsError } = topicIds.length
      ? await admin
          .from("training_sessions")
          .select("id, topic_id, hotel_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
          .in("topic_id", topicIds)
          .order("opened_at", { ascending: false })
      : { data: [], error: null };

    if (sessionsError) {
      return jsonError(sessionsError.message, 500);
    }

    const sessionIds = (sessions ?? []).map((session) => session.id as string);
    const { data: attendances, error: attendancesError } = sessionIds.length
      ? await admin
          .from("training_attendances")
          .select("id, session_id, team_member_id, employee_name_input, employee_number, checked_in_at")
          .in("session_id", sessionIds)
          .order("checked_in_at", { ascending: false })
      : { data: [], error: null };

    if (attendancesError) {
      return jsonError(attendancesError.message, 500);
    }

    const attendanceCountBySession = new Map<string, number>();
    const attendanceRowsBySession = new Map<string, any[]>();
    const memberIds = Array.from(
      new Set((attendances ?? []).map((attendance) => String(attendance.team_member_id ?? "")).filter(Boolean))
    );
    const { data: members, error: membersError } = memberIds.length
      ? await admin.from("team_members").select("id, full_name").in("id", memberIds)
      : { data: [], error: null };

    if (membersError) {
      return jsonError(membersError.message, 500);
    }

    const memberNameById = new Map<string, string | null>();
    for (const member of members ?? []) {
      memberNameById.set(String(member.id), (member.full_name as string | null) ?? null);
    }

    for (const attendance of attendances ?? []) {
      const sessionId = String(attendance.session_id ?? "");
      if (!sessionId) continue;
      attendanceCountBySession.set(sessionId, (attendanceCountBySession.get(sessionId) ?? 0) + 1);
      const bucket = attendanceRowsBySession.get(sessionId) ?? [];
      bucket.push({
        id: attendance.id,
        team_member_id: attendance.team_member_id ?? null,
        employee_name_input: attendance.employee_name_input ?? null,
        employee_number: attendance.employee_number,
        checked_in_at: attendance.checked_in_at,
        validated_member_name: memberNameById.get(String(attendance.team_member_id ?? "")) ?? null,
      });
      attendanceRowsBySession.set(sessionId, bucket);
    }

    const sessionsByTopic = new Map<string, any[]>();
    for (const session of sessions ?? []) {
      const topicId = String(session.topic_id ?? "");
      if (!topicId) continue;
      const bucket = sessionsByTopic.get(topicId) ?? [];
      bucket.push({
        id: session.id,
        topic_id: session.topic_id,
        hotel_id: session.hotel_id,
        status: session.status,
        opened_at: session.opened_at,
        closed_at: session.closed_at,
        supervisor_name_snapshot: session.supervisor_name_snapshot ?? null,
        session_label: session.session_label ?? null,
        attendance_count: attendanceCountBySession.get(String(session.id)) ?? 0,
        attendances: attendanceRowsBySession.get(String(session.id)) ?? [],
      });
      sessionsByTopic.set(topicId, bucket);
    }

    const availableAreas = (areas ?? []).map((area) => ({
      id: String(area.id),
      name: String(area.name ?? "Area"),
    }));

    return jsonNoStore({
      ok: true,
      available_areas: availableAreas,
      topics: (topics ?? []).map((topic) => ({
        id: topic.id,
        hotel_id: topic.hotel_id,
        area_id: topic.area_id ?? null,
        area_name: areaNameById.get(String(topic.area_id ?? "")) ?? null,
        title: topic.title,
        description: topic.description ?? null,
        qr_token: topic.qr_token,
        is_active: topic.is_active,
        created_at: topic.created_at,
        sessions: sessionsByTopic.get(String(topic.id)) ?? [],
      })),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const callerResult = await getTrainingsCaller(request, [
      "admin",
      "quality",
      "manager",
      "general_manager",
    ]);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const body = await request.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    const description = body?.description == null ? null : String(body.description).trim() || null;
    const requestedAreaId = String(body?.area_id ?? "").trim();

    if (!title) {
      return jsonError("title es obligatorio.");
    }

    if (!requestedAreaId) {
      return jsonError("area_id es obligatorio.");
    }

    const admin = supabaseAdmin();
    const allowedAreaIds = await getTrainingsVisibleAreaIds(
      callerResult.caller.profile,
      callerResult.caller.hotelId
    );

    if (!allowedAreaIds.includes(requestedAreaId)) {
      return jsonError("Forbidden: area fuera de alcance.", 403);
    }

    const { data: area, error: areaError } = await admin
      .from("areas")
      .select("id, hotel_id, active, name")
      .eq("id", requestedAreaId)
      .eq("hotel_id", callerResult.caller.hotelId)
      .maybeSingle();

    if (areaError) {
      return jsonError(areaError.message, 500);
    }

    if (!area || area.active === false) {
      return jsonError("Area no encontrada o inactiva.", 404);
    }

    const qrToken = crypto.randomUUID().replace(/-/g, "");
    const { data, error } = await admin
      .from("training_topics")
      .insert({
        hotel_id: callerResult.caller.hotelId,
        area_id: requestedAreaId,
        title,
        description,
        qr_token: qrToken,
        created_by: callerResult.caller.profile.id,
      })
      .select("id, hotel_id, area_id, title, description, qr_token, is_active, created_at")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "No se pudo crear el tema.", 500);
    }

    return jsonNoStore(
      {
        ok: true,
        topic: {
          ...data,
          area_name: area.name ?? null,
          sessions: [],
        },
      },
      201
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
