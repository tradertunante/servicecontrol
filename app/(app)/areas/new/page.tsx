import { requireHotelScope } from "@/lib/auth/server";

import NewAreaPageClient from "./NewAreaPageClient";

export default async function NewAreaPage() {
  const { profile, hotelId } = await requireHotelScope(undefined, {
    nextPath: "/areas/new",
    redirectTo: "/areas",
    permission: "areas.manage",
  });

  return <NewAreaPageClient profile={profile} hotelId={hotelId} />;
}
