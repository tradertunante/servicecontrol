import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";

type Role = "admin" | "quality" | "manager" | "general_manager";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
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
    .select("id, hotel_id, role, active, full_name")
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
      role,
      full_name: (profile.full_name as string | null) ?? null,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request, ["admin", "quality", "manager", "general_manager"]);

    if (!caller.ok) {
      return jsonError(caller.error, caller.status);
    }

    const admin = supabaseAdmin();
    const { data: topics, error: topicsError } = await admin
      .from("training_topics")
      .select("id, hotel_id, title, description, qr_token, is_active, created_at")
      .eq("hotel_id", caller.profile.hotel_id)
      .order("created_at", { ascending: false });

    if (topicsError) {
      return jsonError(topicsError.message, 500);
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
      ? await admin.from("training_attendances").select("session_id").in("session_id", sessionIds)
      : { data: [], error: null };

    if (attendancesError) {
      return jsonError(attendancesError.message, 500);
    }

    const attendanceCountBySession = new Map<string, number>();

    for (const attendance of attendances ?? []) {
      const sessionId = String(attendance.session_id ?? "");
      if (!sessionId) continue;
      attendanceCountBySession.set(sessionId, (attendanceCountBySession.get(sessionId) ?? 0) + 1);
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
      });
      sessionsByTopic.set(topicId, bucket);
    }

    return NextResponse.json({
      ok: true,
      topics: (topics ?? []).map((topic) => ({
        id: topic.id,
        hotel_id: topic.hotel_id,
        title: topic.title,
        description: topic.description ?? null,
        qr_token: topic.qr_token,
        is_active: topic.is_active,
        created_at: topic.created_at,
        sessions: (sessionsByTopic.get(String(topic.id)) ?? []).slice(0, 12),
      })),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request, ["admin", "quality", "manager"]);

    if (!caller.ok) {
      return jsonError(caller.error, caller.status);
    }

    const body = await request.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    const description = body?.description == null ? null : String(body.description).trim() || null;

    if (!title) {
      return jsonError("title es obligatorio.");
    }

    const admin = supabaseAdmin();
    const qrToken = crypto.randomUUID().replace(/-/g, "");

    const { data, error } = await admin
      .from("training_topics")
      .insert({
        hotel_id: caller.profile.hotel_id,
        title,
        description,
        qr_token: qrToken,
        created_by: caller.profile.id,
      })
      .select("id, hotel_id, title, description, qr_token, is_active, created_at")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "No se pudo crear el tema.", 500);
    }

    return NextResponse.json({
      ok: true,
      topic: {
        ...data,
        sessions: [],
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
