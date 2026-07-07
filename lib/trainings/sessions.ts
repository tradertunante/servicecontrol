import "server-only";

import {
  enforceTrainingAreaScope,
  issueTrainingRegistrationToken,
  loadTrainingSession,
  loadTrainingTopic,
} from "@/lib/trainings/server";
import type { Profile } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TrainingsCaller = {
  profile: Profile;
  hotelId: string;
};

type DbErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

/**
 * Service results keep the raw DB error separate from application failures so
 * the transport layer can keep logging DB internals server-side (jsonDbError)
 * without leaking them, while application failures carry their public message.
 */
export type ServiceFailure =
  | { ok: false; kind: "db"; error: DbErrorLike }
  | { ok: false; kind: "app"; error: string; status: number };

type ServiceResult<T> = ({ ok: true } & T) | ServiceFailure;

export type OpenSessionSummary = {
  id: string;
  hotel_id: string;
  topic_id: string;
  status: "open";
  opened_at: string;
  closed_at: string | null;
  supervisor_name_snapshot: string | null;
  session_label: string | null;
  attendance_count: number;
  registration_token: string;
};

export type QrTopicSummary = {
  id: string;
  title: string;
  description: string | null;
  qr_token: string;
};

/**
 * Public (QR) listing of open sessions for a topic, with fresh single-use
 * registration tokens per session.
 */
export async function listOpenSessionsByQrToken(
  qrToken: string,
): Promise<ServiceResult<{ topic: QrTopicSummary; sessions: OpenSessionSummary[] }>> {
  const admin = supabaseAdmin();
  const { data: topic, error: topicError } = await admin
    .from("training_topics")
    .select("id, hotel_id, title, description, qr_token, is_active")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (topicError) return { ok: false, kind: "db", error: topicError };
  if (!topic) return { ok: false, kind: "app", error: "Tema no encontrado.", status: 404 };

  const { data: sessions, error: sessionsError } = await admin
    .from("training_sessions")
    .select("id, hotel_id, topic_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
    .eq("topic_id", topic.id)
    .eq("hotel_id", topic.hotel_id)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (sessionsError) return { ok: false, kind: "db", error: sessionsError };

  const sessionIds = (sessions ?? []).map((session) => String(session.id));
  const { data: attendances, error: attendancesError } = sessionIds.length
    ? await admin.from("training_attendances").select("session_id").in("session_id", sessionIds)
    : { data: [], error: null };

  if (attendancesError) return { ok: false, kind: "db", error: attendancesError };

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
        String(topic.hotel_id),
      ),
    })),
  );

  return {
    ok: true,
    topic: {
      id: String(topic.id),
      title: String(topic.title ?? "Tema"),
      description: topic.description ? String(topic.description) : null,
      qr_token: String(topic.qr_token),
    },
    sessions: serializedSessions,
  };
}

type AuthorizedSession = {
  session: NonNullable<Awaited<ReturnType<typeof loadTrainingSession>>>;
};

/**
 * Shared authorization pipeline for mutations on an existing session:
 * session exists → belongs to the caller's hotel → its topic exists → the
 * caller has area scope over the topic.
 */
async function authorizeSessionForCaller(
  caller: TrainingsCaller,
  sessionId: string,
): Promise<ServiceResult<AuthorizedSession>> {
  const session = await loadTrainingSession(sessionId);
  if (!session) return { ok: false, kind: "app", error: "Sesion no encontrada.", status: 404 };

  if (String(session.hotel_id ?? "") !== caller.hotelId) {
    return { ok: false, kind: "app", error: "Forbidden: sesion fuera de tu hotel.", status: 403 };
  }

  const topic = await loadTrainingTopic(String(session.topic_id ?? ""));
  if (!topic) return { ok: false, kind: "app", error: "Tema no encontrado.", status: 404 };

  const areaScope = await enforceTrainingAreaScope(
    caller.profile,
    caller.hotelId,
    (topic.area_id as string | null) ?? null,
  );
  if (!areaScope.ok) {
    return { ok: false, kind: "app", error: areaScope.error, status: areaScope.status };
  }

  return { ok: true, session };
}

export async function openTrainingSession(
  caller: TrainingsCaller,
  topicId: string,
  sessionLabel: string | null,
): Promise<ServiceResult<{ sessionId: string | null }>> {
  const topic = await loadTrainingTopic(topicId);
  if (!topic || topic.is_active === false) {
    return { ok: false, kind: "app", error: "Tema no encontrado.", status: 404 };
  }

  if (String(topic.hotel_id ?? "") !== caller.hotelId) {
    return { ok: false, kind: "app", error: "Forbidden: tema fuera de tu hotel.", status: 403 };
  }

  const areaScope = await enforceTrainingAreaScope(
    caller.profile,
    caller.hotelId,
    (topic.area_id as string | null) ?? null,
  );
  if (!areaScope.ok) {
    return { ok: false, kind: "app", error: areaScope.error, status: areaScope.status };
  }

  const admin = supabaseAdmin();
  const { data: existingOpenSession, error: existingOpenSessionError } = await admin
    .from("training_sessions")
    .select("id")
    .eq("topic_id", topicId)
    .eq("hotel_id", caller.hotelId)
    .eq("status", "open")
    .maybeSingle();

  if (existingOpenSessionError) return { ok: false, kind: "db", error: existingOpenSessionError };
  if (existingOpenSession?.id) {
    return { ok: false, kind: "app", error: "Ya existe una sesion abierta para este tema.", status: 409 };
  }

  const { data, error } = await admin
    .from("training_sessions")
    .insert({
      hotel_id: caller.hotelId,
      topic_id: topicId,
      status: "open",
      opened_by_profile_id: caller.profile.id,
      supervisor_name_snapshot: caller.profile.full_name ?? null,
      session_label: sessionLabel,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, kind: "db", error };

  return { ok: true, sessionId: data?.id ? String(data.id) : null };
}

export async function closeTrainingSession(
  caller: TrainingsCaller,
  sessionId: string,
): Promise<ServiceResult<Record<never, never>>> {
  const access = await authorizeSessionForCaller(caller, sessionId);
  if (!access.ok) return access;

  if (String(access.session.status ?? "") !== "open") {
    return { ok: false, kind: "app", error: "La sesion ya esta cerrada.", status: 409 };
  }

  const { error } = await supabaseAdmin()
    .from("training_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by_profile_id: caller.profile.id,
    })
    .eq("id", sessionId)
    .eq("hotel_id", caller.hotelId)
    .eq("status", "open");

  if (error) return { ok: false, kind: "db", error };
  return { ok: true };
}

export async function deleteTrainingSession(
  caller: TrainingsCaller,
  sessionId: string,
): Promise<ServiceResult<Record<never, never>>> {
  const access = await authorizeSessionForCaller(caller, sessionId);
  if (!access.ok) return access;

  if (String(access.session.status ?? "") !== "closed") {
    return { ok: false, kind: "app", error: "Solo puedes eliminar sesiones cerradas.", status: 409 };
  }

  const admin = supabaseAdmin();
  const { error: attendancesError } = await admin
    .from("training_attendances")
    .delete()
    .eq("session_id", sessionId)
    .eq("hotel_id", caller.hotelId);

  if (attendancesError) return { ok: false, kind: "db", error: attendancesError };

  const { error: tokensError } = await admin
    .from("training_registration_tokens")
    .delete()
    .eq("session_id", sessionId)
    .eq("hotel_id", caller.hotelId);

  if (tokensError) return { ok: false, kind: "db", error: tokensError };

  const { error: sessionDeleteError } = await admin
    .from("training_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("hotel_id", caller.hotelId)
    .eq("status", "closed");

  if (sessionDeleteError) return { ok: false, kind: "db", error: sessionDeleteError };

  return { ok: true };
}
