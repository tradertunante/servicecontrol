import "server-only";

import type { NextRequest } from "next/server";

import type { Role } from "@/lib/auth/permissions";
import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  type RequestAuthContext,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const AUDIT_EDIT_ROLES: Role[] = [
  "superadmin",
  "admin",
  "general_manager",
  "manager",
  "auditor",
  "quality",
  "mystery_shopper",
];

export type EditableAuditRun = {
  id: string;
  hotel_id: string | null;
  area_id: string | null;
  audit_template_id: string | null;
  executed_by: string | null;
  status: string | null;
  room_number: string | null;
  team_member_id: string | null;
};

export type RunAccessFailureCode =
  | "UNAUTHENTICATED"
  | "HOTEL_SCOPE"
  | "RUN_LOOKUP_FAILED"
  | "RUN_NOT_FOUND"
  | "HOTEL_MISMATCH"
  | "AREA_SCOPE"
  | "AUDITOR_OWNERSHIP"
  | "NOT_DRAFT";

export type RunAccessFailure = {
  ok: false;
  code: RunAccessFailureCode;
  status: number;
  error: string;
};

export type RunAccessGranted = {
  ok: true;
  hotelId: string;
  run: EditableAuditRun;
};

export type RunAccessResult = RunAccessGranted | RunAccessFailure;

export type AuditAccessResult =
  | (RunAccessGranted & { caller: RequestAuthContext })
  | RunAccessFailure;

/**
 * Domain-level authorization for an audit run: hotel scope, area scope,
 * auditor ownership and (optionally) draft status. Framework-free — takes an
 * already-authenticated caller instead of the HTTP request, so route handlers
 * and application services can share it and map failures to their own
 * response envelopes via `code`.
 */
export async function authorizeRunForProfile(
  caller: RequestAuthContext,
  runId: string,
  options?: {
    requireDraft?: boolean;
  },
): Promise<RunAccessResult> {
  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) {
    return { ok: false, code: "HOTEL_SCOPE", status: hotelResult.status, error: hotelResult.error };
  }

  const admin = supabaseAdmin();
  const { data: run, error: runError } = await admin
    .from("audit_runs")
    .select("id, hotel_id, area_id, audit_template_id, executed_by, status, room_number, team_member_id")
    .eq("id", runId)
    .maybeSingle();

  if (runError) {
    console.error("[authorizeRunForProfile] DB error:", runError.message);
    return {
      ok: false,
      code: "RUN_LOOKUP_FAILED",
      status: 500,
      error: "Error interno al verificar la auditoría.",
    };
  }

  if (!run?.id) {
    return { ok: false, code: "RUN_NOT_FOUND", status: 404, error: "La auditoría no existe." };
  }

  if (String(run.hotel_id ?? "") !== hotelResult.hotelId) {
    return {
      ok: false,
      code: "HOTEL_MISMATCH",
      status: 403,
      error: "La auditoría no pertenece al hotel activo.",
    };
  }

  const hasAreaScope = await hasAreaScopeForProfile(
    caller.profile,
    hotelResult.hotelId,
    String(run.area_id ?? ""),
  );

  if (!hasAreaScope) {
    return {
      ok: false,
      code: "AREA_SCOPE",
      status: 403,
      error: "No tienes acceso al área de esta auditoría.",
    };
  }

  if (
    caller.profile.role === "auditor" &&
    String(run.executed_by ?? "") !== caller.profile.id
  ) {
    return {
      ok: false,
      code: "AUDITOR_OWNERSHIP",
      status: 403,
      error: "Un auditor solo puede editar auditorías ejecutadas por sí mismo.",
    };
  }

  if (options?.requireDraft && String(run.status ?? "") !== "draft") {
    return {
      ok: false,
      code: "NOT_DRAFT",
      status: 409,
      error: "La auditoría no está en estado borrador y no admite cambios.",
    };
  }

  return {
    ok: true,
    hotelId: hotelResult.hotelId,
    run: run as EditableAuditRun,
  };
}

export async function authorizeAuditRunAccess(
  request: NextRequest,
  runId: string,
  options?: {
    requireDraft?: boolean;
    roles?: readonly Role[];
  },
): Promise<AuditAccessResult> {
  const caller = await authorizeRouteRequest(request, {
    roles: options?.roles ?? AUDIT_EDIT_ROLES,
  });

  if (!caller) {
    return { ok: false, code: "UNAUTHENTICATED", status: 401, error: "No autorizado." };
  }

  const access = await authorizeRunForProfile(caller, runId, options);
  if (!access.ok) return access;

  return { ...access, caller };
}
