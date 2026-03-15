import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";

type Role = "admin" | "quality" | "manager" | "general_manager";

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

function normalizeRole(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

async function getCaller(request: NextRequest, allowedRoles: Role[]) {
  const token = getBearerToken(request);

  if (!token) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const client = supabaseWithToken(token);
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, hotel_id, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, error: "Perfil invalido.", status: 403 };
  }

  const role = normalizeRole(profile.role);
  const active = profile.active ?? true;

  if (!active || !allowedRoles.includes(role as Role)) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  if (!profile.hotel_id) {
    return { ok: false as const, error: "hotel_id faltante en perfil.", status: 400 };
  }

  return {
    ok: true as const,
    profile: {
      id: profile.id as string,
      hotel_id: profile.hotel_id as string,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request, ["admin", "quality", "manager", "general_manager"]);

    if (!caller.ok) {
      return jsonError(caller.error, caller.status);
    }

    const sessionId = request.nextUrl.searchParams.get("session_id")?.trim() ?? "";
    const admin = supabaseAdmin();

    if (sessionId) {
      const { data: session, error: sessionError } = await admin
        .from("training_sessions")
        .select("id, topic_id, hotel_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
        .eq("id", sessionId)
        .eq("hotel_id", caller.profile.hotel_id)
        .eq("status", "closed")
        .maybeSingle();

      if (sessionError) {
        return jsonError(sessionError.message, 500);
      }

      if (!session) {
        return jsonError("Sesion historica no encontrada.", 404);
      }

      const { data: topic, error: topicError } = await admin
        .from("training_topics")
        .select("id, title")
        .eq("id", session.topic_id)
        .eq("hotel_id", caller.profile.hotel_id)
        .maybeSingle();

      if (topicError) {
        return jsonError(topicError.message, 500);
      }

      const { data: attendances, error: attendancesError } = await admin
        .from("training_attendances")
        .select("id, team_member_id, employee_name_input, employee_number, checked_in_at")
        .eq("session_id", session.id)
        .order("checked_in_at", { ascending: false });

      if (attendancesError) {
        return jsonError(attendancesError.message, 500);
      }

      const memberIds = Array.from(
        new Set(
          (attendances ?? [])
            .map((attendance) => String(attendance.team_member_id ?? ""))
            .filter(Boolean)
        )
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

      return jsonNoStore({
        ok: true,
        session: {
          id: session.id,
          topic_id: session.topic_id,
          topic_title: topic?.title ?? "Tema",
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
      .eq("hotel_id", caller.profile.hotel_id)
      .eq("status", "closed")
      .order("closed_at", { ascending: false });

    if (sessionsError) {
      return jsonError(sessionsError.message, 500);
    }

    const topicIds = Array.from(
      new Set((sessions ?? []).map((session) => String(session.topic_id ?? "")).filter(Boolean))
    );

    const { data: topics, error: topicsError } = topicIds.length
      ? await admin.from("training_topics").select("id, title").in("id", topicIds)
      : { data: [], error: null };

    if (topicsError) {
      return jsonError(topicsError.message, 500);
    }

    const topicTitleById = new Map<string, string>();

    for (const topic of topics ?? []) {
      topicTitleById.set(String(topic.id), String(topic.title ?? "Tema"));
    }

    const sessionIds = (sessions ?? []).map((session) => String(session.id ?? "")).filter(Boolean);
    const { data: attendances, error: attendancesError } = sessionIds.length
      ? await admin.from("training_attendances").select("session_id").in("session_id", sessionIds)
      : { data: [], error: null };

    if (attendancesError) {
      return jsonError(attendancesError.message, 500);
    }

    const attendanceCountBySession = new Map<string, number>();

    for (const attendance of attendances ?? []) {
      const key = String(attendance.session_id ?? "");
      if (!key) continue;
      attendanceCountBySession.set(key, (attendanceCountBySession.get(key) ?? 0) + 1);
    }

    return jsonNoStore({
      ok: true,
      sessions: (sessions ?? []).map((session) => ({
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
