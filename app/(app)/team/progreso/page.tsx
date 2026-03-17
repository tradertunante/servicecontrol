import { requirePageAccess } from "@/lib/auth/server";

import TeamProgressPageClient from "./TeamProgressPageClient";

export default async function TeamProgressPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "team",
    requireHotel: true,
    nextPath: "/team/progreso",
    redirectTo: "/dashboard",
  });

  return <TeamProgressPageClient initialProfile={profile} initialHotelId={hotelId} />;
}
