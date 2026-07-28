import { NextRequest } from "next/server";

import { jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function POST(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return jsonError("El nombre del certificado es obligatorio.");

  const { data, error } = await supabaseAdmin()
    .from("certification_standards")
    .insert({ hotel_id: null, name, active: true })
    .select("id,hotel_id,name,active,created_at")
    .single();

  if (error || !data?.id) {
    if (error?.code === "23505") {
      return jsonError("Ya existe un certificado con ese nombre.");
    }
    return jsonDbError(error, "No se pudo crear el certificado.");
  }

  return jsonOk({ certification: data, created_by: caller.profile.id });
}
