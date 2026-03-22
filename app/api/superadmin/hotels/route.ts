import { NextRequest } from "next/server";
import { jsonDbError } from "@/lib/api/response";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireSuperadminRoute } from "@/lib/superadmin/server";

export async function POST(request: NextRequest) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();

  if (!name) return jsonError("name es obligatorio.");

  const { data, error } = await supabaseAdmin()
    .from("hotels")
    .insert([{ name, active: true }])
    .select("id, name, active, created_at");

  if (error) return jsonDbError(error);

  return jsonOk({
    hotels: (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      active: row.active ?? null,
      created_at: row.created_at ? String(row.created_at) : null,
    })),
    created_by: caller.profile.id,
  });
}
