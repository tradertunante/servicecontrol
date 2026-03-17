import { requirePageAccess } from "@/lib/auth/server";

import StandardsPageClient from "./StandardsPageClient";

export default async function StandardsPage() {
  const auth = await requirePageAccess({
    roles: ["admin", "superadmin"],
    requireHotel: true,
    nextPath: "/standards",
    redirectTo: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return <StandardsPageClient initialProfile={auth.profile} hotelId={hotelId ?? ""} />;
}
