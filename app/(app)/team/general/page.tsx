import { requirePageAccess } from "@/lib/auth/server";

import TeamGeneralPageClient from "./TeamGeneralPageClient";

export default async function TeamGeneralPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "team",
    requireHotel: true,
    nextPath: "/team/general",
    redirectTo: "/dashboard",
  });

  return <TeamGeneralPageClient initialProfile={profile} initialHotelId={hotelId} />;
}
