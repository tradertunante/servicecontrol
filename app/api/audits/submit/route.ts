import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as SubmitAuditBody | null;
    const runId = typeof body?.run_id === "string" ? body.run_id : "";
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

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

    if (!token) {
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

    const authClient = supabaseWithToken(token);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return rpcErrorResponse({
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        status: 401,
        error: {
          type: "auth",
          field: null,
          question_id: null,
          details: authError
            ? {
                message: authError.message,
              }
            : {},
        },
        meta: {
          run_id: runId,
          actor_user_id: null,
          idempotent: false,
          submitted: false,
        },
      });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc("submit_audit_run", {
      p_run_id: runId,
      p_actor_user_id: user.id,
    });

    if (error) {
      return rpcErrorResponse({
        code: "RPC_EXECUTION_FAILED",
        message: "Failed to execute submit_audit_run.",
        status: 500,
        error: {
          type: "internal",
          field: null,
          question_id: null,
          details: {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
        },
        meta: {
          run_id: runId,
          actor_user_id: user.id,
          idempotent: false,
          submitted: false,
        },
      });
    }

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
