import { requirePageAccess } from "@/lib/auth/server";

import TeamHistorialPageClient from "./TeamHistorialPageClient";

export default async function TeamHistorialPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "team",
    requireHotel: true,
    nextPath: "/team/historial",
    redirectTo: "/dashboard",
  });

  return <TeamHistorialPageClient initialProfile={profile} initialHotelId={hotelId} />;
}
