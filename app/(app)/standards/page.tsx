import { requirePageAccess } from "@/lib/auth/server";

import StandardsPageClient from "./StandardsPageClient";

export default async function StandardsPage() {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["admin", "superadmin"],
    requireHotel: true,
    nextPath: "/standards",
    redirectTo: "/dashboard",
  });

  return <StandardsPageClient initialProfile={profile} hotelId={hotelId} />;
}
