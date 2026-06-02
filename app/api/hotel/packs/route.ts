import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, getActiveHotel } from "@/lib/auth/server";
import { getHotelEnabledPacks } from "@/lib/auth/packs";
import { jsonError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const activeHotel = await getActiveHotel(request, caller.profile);
  if (!activeHotel.ok) return jsonError(activeHotel.error, 400);

  // Superadmin siempre tiene acceso a todos los packs
  if (caller.profile.role === "superadmin") {
    return NextResponse.json({ packs: ["base", "pack1", "pack2", "pack_it", "pack_engineering", "pack3"] });
  }

  const packs = await getHotelEnabledPacks(activeHotel.hotelId);
  return NextResponse.json({ packs });
}
