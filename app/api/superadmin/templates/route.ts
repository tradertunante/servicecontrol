import { jsonDbError } from "@/lib/api/response";
import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function POST(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "Nueva plantilla global").trim();

  if (!name) {
    return jsonError("El nombre de la plantilla es obligatorio.");
  }

  const { data, error } = await supabaseAdmin()
    .from("audit_templates")
    .insert({
      name,
      scope: "global",
      active: true,
      area_id: null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return jsonDbError(error, "No se pudo crear la plantilla global.");
  }

  return jsonOk({
    template_id: String(data.id),
    created_by: caller.profile.id,
  });
}
