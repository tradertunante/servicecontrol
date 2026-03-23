import { jsonDbError } from "@/lib/api/response";
import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function POST(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const businessType = String(body?.business_type ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim() || null;
  const active = body?.active !== false;

  if (!businessType) return jsonError("business_type es obligatorio.");
  if (!name) return jsonError("name es obligatorio.");

  const { data, error } = await supabaseAdmin()
    .from("global_audit_packs")
    .insert({
      business_type: businessType,
      name,
      description,
      active,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return jsonDbError(error, "No se pudo crear el pack.");
  }

  return jsonOk({
    pack_id: String(data.id),
    created_by: caller.profile.id,
  });
}
