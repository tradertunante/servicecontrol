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
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

    if (!token) {
      return jsonError("token es obligatorio.", 400);
    }

    const admin = supabaseAdmin();
    const { data: topic, error: topicError } = await admin
      .from("training_topics")
      .select("id, title, description, qr_token, hotel_id, is_active")
      .eq("qr_token", token)
      .maybeSingle();

    if (topicError) {
      return jsonError(topicError.message, 500);
    }

    if (!topic || topic.is_active === false) {
      return jsonError("Tema no encontrado.", 404);
    }

    const { data: sessions, error: sessionsError } = await admin
      .from("training_sessions")
      .select("id, topic_id, hotel_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
      .eq("topic_id", topic.id)
      .eq("hotel_id", topic.hotel_id)
      .eq("status", "open")
      .order("opened_at", { ascending: false });

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

    return NextResponse.json({
      ok: true,
      topic: {
        id: topic.id,
        title: topic.title,
        description: topic.description ?? null,
        qr_token: topic.qr_token,
      },
      sessions: (sessions ?? []).map((session) => ({
        id: session.id,
        topic_id: session.topic_id,
        hotel_id: session.hotel_id,
        status: session.status,
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

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request, ["admin", "quality", "manager", "general_manager"]);

    if (!caller.ok) {
      return jsonError(caller.error, caller.status);
    }

    const body = await request.json().catch(() => null);
    const topicId = String(body?.topic_id ?? "").trim();
    const sessionLabel = body?.session_label == null ? null : String(body.session_label).trim() || null;

    if (!topicId) {
      return jsonError("topic_id es obligatorio.");
    }

    const admin = supabaseAdmin();
    const { data: topic, error: topicError } = await admin
      .from("training_topics")
      .select("id, hotel_id, is_active")
      .eq("id", topicId)
      .eq("hotel_id", caller.profile.hotel_id)
      .maybeSingle();

    if (topicError) {
      return jsonError(topicError.message, 500);
    }

    if (!topic || topic.is_active === false) {
      return jsonError("Tema no encontrado.", 404);
    }

    const supervisorNameSnapshot = caller.profile.full_name?.trim() || "Supervisor";

    const { data, error } = await admin
      .from("training_sessions")
      .insert({
        hotel_id: caller.profile.hotel_id,
        topic_id: topic.id,
        opened_by_profile_id: caller.profile.id,
        supervisor_name_snapshot: supervisorNameSnapshot,
        session_label: sessionLabel,
      })
      .select("id, topic_id, hotel_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "No se pudo abrir la sesion.", 500);
    }

    return NextResponse.json({
      ok: true,
      session: {
        ...data,
        attendance_count: 0,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await getCaller(request, ["admin", "quality", "manager", "general_manager"]);

    if (!caller.ok) {
      return jsonError(caller.error, caller.status);
    }

    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();

    if (!sessionId) {
      return jsonError("session_id es obligatorio.");
    }

    const admin = supabaseAdmin();
    const { data: session, error: sessionError } = await admin
      .from("training_sessions")
      .select("id, hotel_id, status")
      .eq("id", sessionId)
      .eq("hotel_id", caller.profile.hotel_id)
      .maybeSingle();

    if (sessionError) {
      return jsonError(sessionError.message, 500);
    }

    if (!session) {
      return jsonError("Sesion no encontrada.", 404);
    }

    if (session.status === "closed") {
      return NextResponse.json({ ok: true, already_closed: true });
    }

    const { error } = await admin
      .from("training_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by_profile_id: caller.profile.id,
      })
      .eq("id", session.id)
      .eq("hotel_id", caller.profile.hotel_id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getCaller(request, ["admin", "quality", "manager", "general_manager"]);

    if (!caller.ok) {
      return jsonError(caller.error, caller.status);
    }

    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();

    if (!sessionId) {
      return jsonError("session_id es obligatorio.");
    }

    const admin = supabaseAdmin();
    const { data: session, error: sessionError } = await admin
      .from("training_sessions")
      .select("id, hotel_id, status")
      .eq("id", sessionId)
      .eq("hotel_id", caller.profile.hotel_id)
      .maybeSingle();

    if (sessionError) {
      return jsonError(sessionError.message, 500);
    }

    if (!session) {
      return jsonError("Sesion no encontrada.", 404);
    }

    if (session.status !== "closed") {
      return jsonError("Solo se pueden eliminar sesiones cerradas.", 409);
    }

    const { error } = await admin
      .from("training_sessions")
      .delete()
      .eq("id", session.id)
      .eq("hotel_id", caller.profile.hotel_id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Error inesperado.", 500);
  }
}
