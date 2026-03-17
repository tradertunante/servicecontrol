import { requirePageAccess } from "@/lib/auth/server";

import TeamTemplatesPageClient from "./TeamTemplatesPageClient";

export default async function TeamTemplatesPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "team",
    requireHotel: true,
    nextPath: "/team/templates",
    redirectTo: "/dashboard",
  });

  return <TeamTemplatesPageClient initialProfile={profile} initialHotelId={hotelId} />;
}
