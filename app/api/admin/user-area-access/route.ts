import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  targetUserId: string;
  hotelId: string;
  areaIds?: string[];      // las áreas que quieres asignar
  removeAll?: boolean;     // opcional: borrar todas antes de insertar
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRole) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const admin = getAdminClient();

    const body = (await req.json()) as Body;

    const targetUserId = body?.targetUserId?.trim();
    const hotelId = body?.hotelId?.trim();

    // IMPORTANTE: aquí forzamos el tipo a string[]
    const areaIds: string[] = Array.isArray(body?.areaIds)
      ? body.areaIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];

    const removeAll = Boolean(body?.removeAll);

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId requerido" }, { status: 400 });
    }
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId requerido" }, { status: 400 });
    }

    // Si quieres limpiar todo primero
    if (removeAll) {
      const { error: delErr } = await admin
        .from("user_area_access")
        .delete()
        .eq("user_id", targetUserId)
        .eq("hotel_id", hotelId);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 });
      }
    }

    // Insertamos los nuevos (si hay)
    if (areaIds.length > 0) {
      const rows = areaIds.map((area_id: string) => ({
        user_id: targetUserId,
        area_id,
        hotel_id: hotelId,
      }));

      const { error: insErr } = await admin.from("user_area_access").insert(rows);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
