import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { canSubmitAudit } from "@/lib/auth/permissions";
import { authorizeRouteRequest } from "@/lib/auth/server";
import { AUDIT_EDIT_ROLES } from "@/lib/audits/server";
import { submitAuditRun, runPostSubmitTasks } from "@/lib/audits/submitRun";

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

    const caller = await authorizeRouteRequest(request, { roles: AUDIT_EDIT_ROLES });

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

    const result = await submitAuditRun(caller, runId);

    if (!result.ok) {
      const { failure } = result;
      return rpcErrorResponse({
        code: failure.code,
        message: failure.message,
        status: failure.status,
        error: {
          type: failure.errorType,
          field: failure.field,
          question_id: null,
          details: failure.details,
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
    waitUntil(runPostSubmitTasks(runId, caller.profile.id));

    return NextResponse.json(result.data);
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
