import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  targetUserId: string;
  hotelId: string;
  areaIds: string[]; // <- importante (evita any)
};

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function isBody(x: unknown): x is Body {
  if (!x || typeof x !== "object") return false;
  const b = x as any;
  return (
    typeof b.targetUserId === "string" &&
    typeof b.hotelId === "string" &&
    Array.isArray(b.areaIds) &&
    b.areaIds.every((v: unknown) => typeof v === "string")
  );
}

/**
 * POST: Reemplaza las áreas habilitadas para un usuario auditor en un hotel.
 * Body:
 *  - targetUserId: string
 *  - hotelId: string
 *  - areaIds: string[] (puede ser [])
 */
export async function POST(req: Request) {
  try {
    const supabase = adminSupabase();

    const json = await req.json().catch(() => null);
    if (!isBody(json)) {
      return NextResponse.json(
        { error: "Invalid body. Expected { targetUserId, hotelId, areaIds[] }" },
        { status: 400 }
      );
    }

    const { targetUserId, hotelId, areaIds } = json;

    // 1) Borramos lo anterior
    const { error: delErr } = await supabase
      .from("user_area_access")
      .delete()
      .eq("user_id", targetUserId)
      .eq("hotel_id", hotelId);

    if (delErr) {
      return NextResponse.json(
        { error: `Delete failed: ${delErr.message}` },
        { status: 500 }
      );
    }

    // 2) Insertamos lo nuevo (si hay)
    if (areaIds.length > 0) {
      const rows = areaIds.map((area_id: string) => ({
        user_id: targetUserId,
        area_id,
        hotel_id: hotelId,
      }));

      const { error: insErr } = await supabase
        .from("user_area_access")
        .insert(rows);

      if (insErr) {
        return NextResponse.json(
          { error: `Insert failed: ${insErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
