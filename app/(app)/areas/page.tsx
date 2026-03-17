import { requirePageAccess } from "@/lib/auth/server";

import AreasPageClient from "./AreasPageClient";

export default async function AreasPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "areas",
    requireHotel: true,
    nextPath: "/areas",
    redirectTo: "/dashboard",
  });

  return <AreasPageClient initialProfile={profile} hotelId={hotelId} />;
}
