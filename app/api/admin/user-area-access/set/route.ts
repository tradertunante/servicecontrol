// app/api/admin/user-area-access/set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest } from "@/lib/auth/server";
import { resolveManagedUserAccess } from "@/lib/auth/userManagement";
import { jsonError , jsonDbError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(16).slice(2, 8);

  try {
    const caller = await authorizeRouteRequest(req, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado (falta token).", 401);

    const body = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "");
    const area_ids_raw = Array.isArray(body?.area_ids) ? body.area_ids : [];
    const area_ids = area_ids_raw.map((x: any) => String(x)).filter(Boolean);

    if (!user_id) return jsonError("Falta user_id.", 400);
    const targetScope = await resolveManagedUserAccess(caller.profile, user_id);
    if (!targetScope.ok) {
      return jsonError(targetScope.error, targetScope.status);
    }

    const admin = supabaseAdmin();
    const hotelId = targetScope.hotelId;

    const uuidAreaIds = area_ids as string[];
    const { data, error } = await admin.rpc("set_user_area_access_atomic", {
      p_user_id: user_id,
      p_hotel_id: hotelId,
      p_area_ids: uuidAreaIds,
    });

    if (error) {
      console.error(`[uaa-set:${reqId}] rpc`, error.message);
      return jsonDbError(error);
    }

    const payload = (data ?? null) as {
      ok?: boolean;
      code?: string;
      message?: string;
      data?: { count?: number } | null;
    } | null;

    if (!payload?.ok) {
      const status = String(payload?.code ?? "") === "INVALID_AREAS" ? 400 : 500;
      return jsonError(payload?.message ?? "No se pudo actualizar los accesos.", status);
    }

    return NextResponse.json({ ok: true, count: Number(payload.data?.count ?? 0) });
  } catch (e: any) {
    console.error(`[uaa-set:${reqId}] Unexpected`, e?.message);
    return jsonDbError(e, "Error inesperado.");
  }
}
