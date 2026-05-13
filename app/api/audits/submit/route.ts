import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { canSubmitAudit } from "@/lib/auth/permissions";
import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInstantNotifications } from "@/lib/email/sendInstantNotifications";
import { updateBrevoContact } from "@/lib/brevo";
import { logger } from "@/lib/logger";

async function maybeTrackFirstAudit(userId: string) {
  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_trial, first_audit_completed_at, email")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.is_trial || profile.first_audit_completed_at) return;

  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({ first_audit_completed_at: now })
    .eq("id", userId);

  if (profile.email) {
    await updateBrevoContact(profile.email, { FIRST_AUDIT_AT: now });
  }
}

type SubmitAuditBody = {
  run_id?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function rpcErrorResponse({
  code,
  message,
  status,
  error,
  meta,
}: {
  code: string;
  message: string;
  status: number;
  error: {
    type: string;
    field: string | null;
    question_id: string | null;
    details: Record<string, unknown>;
  };
  meta: Record<string, unknown>;
}) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      data: null,
      error,
      meta,
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as SubmitAuditBody | null;
    const runId = typeof body?.run_id === "string" ? body.run_id.trim() : "";

    if (!runId || !isUuid(runId)) {
      return rpcErrorResponse({
        code: "INVALID_BODY",
        message: "Body invalido: run_id debe ser un uuid.",
        status: 400,
        error: {
          type: "validation",
          field: "run_id",
          question_id: null,
          details: {},
        },
        meta: {
          run_id: runId || null,
          actor_user_id: null,
          idempotent: false,
          submitted: false,
        },
      });
    }

    const caller = await authorizeRouteRequest(request, {
      roles: ["superadmin", "admin", "general_manager", "manager", "auditor", "quality"],
    });

    if (!caller) {
      return rpcErrorResponse({
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        status: 401,
        error: {
          type: "auth",
          field: null,
          question_id: null,
          details: {
            reason: "missing_bearer_token",
          },
        },
        meta: {
          run_id: runId,
          actor_user_id: null,
          idempotent: false,
          submitted: false,
        },
      });
    }

    if (!canSubmitAudit(caller.profile.role)) {
      return rpcErrorResponse({
        code: "FORBIDDEN",
        message: "No tienes permisos para enviar esta auditoría.",
        status: 403,
        error: {
          type: "authorization",
          field: "run_id",
          question_id: null,
          details: {
            role: caller.profile.role,
          },
        },
        meta: {
          run_id: runId,
          actor_user_id: caller.profile.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) {
      return rpcErrorResponse({
        code: "FORBIDDEN",
        message: hotelResult.error,
        status: hotelResult.status,
        error: {
          type: "authorization",
          field: "run_id",
          question_id: null,
          details: {},
        },
        meta: {
          run_id: runId,
          actor_user_id: caller.profile.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

    const admin = supabaseAdmin();
    const { data: run, error: runError } = await admin
      .from("audit_runs")
      .select("id, hotel_id, area_id, executed_by")
      .eq("id", runId)
      .maybeSingle();

    if (runError) {
      return rpcErrorResponse({
        code: "RUN_LOOKUP_FAILED",
        message: "Error interno al buscar la auditoría.",
        status: 500,
        error: {
          type: "internal",
          field: "run_id",
          question_id: null,
          details: {},
        },
        meta: {
          run_id: runId,
          actor_user_id: caller.profile.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

    if (!run?.id || String(run.hotel_id ?? "") !== hotelResult.hotelId) {
      return rpcErrorResponse({
        code: "FORBIDDEN",
        message: "La auditoría no pertenece al hotel activo.",
        status: 403,
        error: {
          type: "authorization",
          field: "run_id",
          question_id: null,
          details: {},
        },
        meta: {
          run_id: runId,
          actor_user_id: caller.profile.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

    const hasAreaScope = await hasAreaScopeForProfile(
      caller.profile,
      hotelResult.hotelId,
      String(run.area_id ?? "")
    );

    if (!hasAreaScope) {
      return rpcErrorResponse({
        code: "FORBIDDEN",
        message: "No tienes acceso al área de esta auditoría.",
        status: 403,
        error: {
          type: "authorization",
          field: "run_id",
          question_id: null,
          details: {},
        },
        meta: {
          run_id: runId,
          actor_user_id: caller.profile.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

    if (
      caller.profile.role === "auditor" &&
      String(run.executed_by ?? "") !== caller.profile.id
    ) {
      return rpcErrorResponse({
        code: "FORBIDDEN",
        message: "Un auditor solo puede enviar auditorías ejecutadas por sí mismo.",
        status: 403,
        error: {
          type: "authorization",
          field: "run_id",
          question_id: null,
          details: {},
        },
        meta: {
          run_id: runId,
          actor_user_id: caller.profile.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

    const { data, error } = await admin.rpc("submit_audit_run", {
      p_run_id: runId,
      p_actor_user_id: caller.profile.id,
    });

    if (error) {
      await logger.error("submit_audit_run_rpc_error", { message: error.message, details: error.details, hint: error.hint, code: error.code });
      return rpcErrorResponse({
        code: "RPC_EXECUTION_FAILED",
        message: "Error interno al procesar la auditoría.",
        status: 500,
        error: {
          type: "internal",
          field: null,
          question_id: null,
          details: {},
        },
        meta: {
          run_id: runId,
          actor_user_id: caller.profile.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

    // Send emails and track trial signals in the background.
    // waitUntil keeps the function alive after the response is sent.
    waitUntil(
      Promise.all([
        sendInstantNotifications(runId).catch((err) =>
          logger.error("instant_email_background_error", { error: err instanceof Error ? err.message : String(err) })
        ),
        maybeTrackFirstAudit(caller.profile.id).catch(() => undefined),
      ])
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";

    return rpcErrorResponse({
      code: "UNEXPECTED_ERROR",
      message,
      status: 500,
      error: {
        type: "internal",
        field: null,
        question_id: null,
        details: {},
      },
      meta: {
        run_id: null,
        actor_user_id: null,
        idempotent: false,
        submitted: false,
      },
    });
  }
}
