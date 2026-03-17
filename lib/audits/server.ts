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

export type AuditAccessResult =
  | {
      ok: true;
      hotelId: string;
      run: EditableAuditRun;
      caller: RequestAuthContext;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

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
    return { ok: false, status: 401, error: "No autorizado." };
  }

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) {
    return { ok: false, status: hotelResult.status, error: hotelResult.error };
  }

  const admin = supabaseAdmin();
  const { data: run, error: runError } = await admin
    .from("audit_runs")
    .select("id, hotel_id, area_id, audit_template_id, executed_by, status, room_number, team_member_id")
    .eq("id", runId)
    .maybeSingle();

  if (runError) {
    return { ok: false, status: 500, error: runError.message };
  }

  if (!run?.id) {
    return { ok: false, status: 404, error: "La auditoría no existe." };
  }

  if (String(run.hotel_id ?? "") !== hotelResult.hotelId) {
    return { ok: false, status: 403, error: "La auditoría no pertenece al hotel activo." };
  }

  const hasAreaScope = await hasAreaScopeForProfile(
    caller.profile,
    hotelResult.hotelId,
    String(run.area_id ?? ""),
  );

  if (!hasAreaScope) {
    return { ok: false, status: 403, error: "No tienes acceso al área de esta auditoría." };
  }

  if (
    caller.profile.role === "auditor" &&
    String(run.executed_by ?? "") !== caller.profile.id
  ) {
    return {
      ok: false,
      status: 403,
      error: "Un auditor solo puede editar auditorías ejecutadas por sí mismo.",
    };
  }

  if (options?.requireDraft && String(run.status ?? "") === "submitted") {
    return {
      ok: false,
      status: 409,
      error: "La auditoría ya fue enviada y no admite cambios.",
    };
  }

  return {
    ok: true,
    hotelId: hotelResult.hotelId,
    run: run as EditableAuditRun,
    caller,
  };
}
