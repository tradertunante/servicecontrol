import { NextRequest, NextResponse } from "next/server";

import { getTrainingsCaller } from "@/lib/trainings/server";
import {
  closeTrainingSession,
  deleteTrainingSession,
  listOpenSessionsByQrToken,
  openTrainingSession,
  type ServiceFailure,
} from "@/lib/trainings/sessions";
import { jsonError, jsonDbError } from "@/lib/api/response";

const SESSION_MANAGER_ROLES = ["admin", "quality", "manager", "general_manager"] as const;

function jsonNoStore(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function serviceFailureResponse(failure: ServiceFailure) {
  if (failure.kind === "db") return jsonDbError(failure.error);
  return jsonError(failure.error, failure.status);
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

    if (!token) {
      return jsonError("token es obligatorio.", 400);
    }

    const result = await listOpenSessionsByQrToken(token);
    if (!result.ok) return serviceFailureResponse(result);

    return jsonNoStore({
      ok: true,
      topic: result.topic,
      sessions: result.sessions,
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getTrainingsCaller(request, SESSION_MANAGER_ROLES);
    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await request.json().catch(() => null);
    const topicId = String(body?.topic_id ?? "").trim();
    const sessionLabel =
      body?.session_label == null ? null : String(body.session_label).trim() || null;

    if (!topicId) return jsonError("topic_id es obligatorio.", 400);

    const result = await openTrainingSession(caller.caller, topicId, sessionLabel);
    if (!result.ok) return serviceFailureResponse(result);

    return NextResponse.json({ ok: true, session_id: result.sessionId });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await getTrainingsCaller(request, SESSION_MANAGER_ROLES);
    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();

    if (!sessionId) return jsonError("session_id es obligatorio.", 400);

    const result = await closeTrainingSession(caller.caller, sessionId);
    if (!result.ok) return serviceFailureResponse(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getTrainingsCaller(request, SESSION_MANAGER_ROLES);
    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await request.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "").trim();

    if (!sessionId) return jsonError("session_id es obligatorio.", 400);

    const result = await deleteTrainingSession(caller.caller, sessionId);
    if (!result.ok) return serviceFailureResponse(result);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}
