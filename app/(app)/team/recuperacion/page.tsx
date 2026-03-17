import { requirePageAccess } from "@/lib/auth/server";

import TeamRecuperacionPageClient from "./TeamRecuperacionPageClient";

export default async function TeamRecuperacionPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "team",
    requireHotel: true,
    nextPath: "/team/recuperacion",
    redirectTo: "/dashboard",
  });

  return <TeamRecuperacionPageClient initialProfile={profile} initialHotelId={hotelId} />;
}
