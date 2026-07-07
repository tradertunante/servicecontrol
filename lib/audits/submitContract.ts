import type { RunAccessFailure } from "@/lib/audits/server";

export type SubmitAuditFailure = {
  code: "FORBIDDEN" | "RUN_LOOKUP_FAILED" | "RPC_EXECUTION_FAILED";
  message: string;
  status: number;
  errorType: "authorization" | "internal";
  field: string | null;
  details: Record<string, unknown>;
};

export type SubmitAuditOutcome =
  | { ok: true; data: unknown }
  | { ok: false; failure: SubmitAuditFailure };

/**
 * Preserves the exact HTTP contract the submit endpoint has always exposed:
 * a missing run and a hotel mismatch are both reported as the same 403 so the
 * endpoint does not reveal whether a run id exists outside the caller's hotel.
 */
export function mapRunAccessFailureToSubmitFailure(
  failure: RunAccessFailure,
): SubmitAuditFailure {
  switch (failure.code) {
    case "RUN_LOOKUP_FAILED":
      return {
        code: "RUN_LOOKUP_FAILED",
        message: "Error interno al buscar la auditoría.",
        status: 500,
        errorType: "internal",
        field: "run_id",
        details: {},
      };
    case "RUN_NOT_FOUND":
    case "HOTEL_MISMATCH":
      return {
        code: "FORBIDDEN",
        message: "La auditoría no pertenece al hotel activo.",
        status: 403,
        errorType: "authorization",
        field: "run_id",
        details: {},
      };
    case "AUDITOR_OWNERSHIP":
      return {
        code: "FORBIDDEN",
        message: "Un auditor solo puede enviar auditorías ejecutadas por sí mismo.",
        status: 403,
        errorType: "authorization",
        field: "run_id",
        details: {},
      };
    default:
      return {
        code: "FORBIDDEN",
        message: failure.error,
        status: failure.status,
        errorType: "authorization",
        field: "run_id",
        details: {},
      };
  }
}
