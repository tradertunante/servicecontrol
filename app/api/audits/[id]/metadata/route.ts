import { NextRequest, NextResponse } from "next/server";

import { authorizeAuditRunAccess } from "@/lib/audits/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";

function normalizeOptionalString(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const runId = String(params?.id ?? "").trim();
  if (!runId) return jsonError("runId es obligatorio.");

  const access = await authorizeAuditRunAccess(request, runId, { requireDraft: true });
  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  const body = await request.json().catch(() => null);
  const teamMemberId = normalizeOptionalString(body?.team_member_id);
  const roomNumber = normalizeOptionalString(body?.room_number);

  const updates: Record<string, string | null> = {};
  if (teamMemberId !== undefined) {
    updates.team_member_id = teamMemberId;
  }
  if (roomNumber !== undefined) {
    updates.room_number = roomNumber;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No hay campos editables para actualizar.");
  }

  const admin = supabaseAdmin();

  if (teamMemberId !== undefined && teamMemberId !== null) {
    const { data: teamMember, error: teamMemberError } = await admin
      .from("team_members")
      .select("id, hotel_id, active")
      .eq("id", teamMemberId)
      .maybeSingle();

    if (teamMemberError) {
      console.error("[metadata] team member lookup error:", teamMemberError.message);
      return jsonError("Error interno al verificar el colaborador.", 500);
    }
    if (!teamMember?.id || String(teamMember.hotel_id ?? "") !== access.hotelId) {
      return jsonError("El colaborador no pertenece al hotel activo.", 403);
    }
    if (teamMember.active === false) {
      return jsonError("El colaborador seleccionado está inactivo.", 409);
    }
  }

  const { data, error } = await admin
    .from("audit_runs")
    .update(updates)
    .eq("id", access.run.id)
    .select("id, team_member_id, room_number, status")
    .single();

  if (error || !data) {
    console.error("[metadata] update error:", error?.message);
    return jsonError("No se pudo actualizar la auditoría.", 500);
  }

  return NextResponse.json({
    ok: true,
    run: data,
  });
}
