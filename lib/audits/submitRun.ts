import "server-only";

import { authorizeRunForProfile } from "@/lib/audits/server";
import {
  mapRunAccessFailureToSubmitFailure,
  type SubmitAuditOutcome,
} from "@/lib/audits/submitContract";
import type { RequestAuthContext } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInstantNotifications } from "@/lib/email/sendInstantNotifications";
import { updateBrevoContact } from "@/lib/integrations/brevo";
import { logger } from "@/lib/logger";

/**
 * Application service for submitting an audit run: authorizes the caller
 * against the run (hotel scope, area scope, auditor ownership) and executes
 * the transactional `submit_audit_run` RPC. Transport concerns (body parsing,
 * response envelopes, background scheduling) stay in the route handler.
 */
export async function submitAuditRun(
  caller: RequestAuthContext,
  runId: string,
): Promise<SubmitAuditOutcome> {
  const access = await authorizeRunForProfile(caller, runId);
  if (!access.ok) {
    return { ok: false, failure: mapRunAccessFailureToSubmitFailure(access) };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("submit_audit_run", {
    p_run_id: runId,
    p_actor_user_id: caller.profile.id,
  });

  if (error) {
    await logger.error("submit_audit_run_rpc_error", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return {
      ok: false,
      failure: {
        code: "RPC_EXECUTION_FAILED",
        message: "Error interno al procesar la auditoría.",
        status: 500,
        errorType: "internal",
        field: null,
        details: {},
      },
    };
  }

  return { ok: true, data };
}

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

/**
 * Fire-and-forget side effects after a successful submission (instant email
 * notifications, trial activation tracking). The caller decides how to keep
 * the runtime alive (e.g. `waitUntil` on Vercel).
 */
export function runPostSubmitTasks(runId: string, userId: string): Promise<unknown> {
  return Promise.all([
    sendInstantNotifications(runId).catch((err) =>
      logger.error("instant_email_background_error", {
        error: err instanceof Error ? err.message : String(err),
      }),
    ),
    maybeTrackFirstAudit(userId).catch(() => undefined),
  ]);
}
