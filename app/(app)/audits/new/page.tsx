import { getActiveHotel, requireAuthenticatedUser } from "@/lib/auth/server";

import NewAuditPageClient from "./NewAuditPageClient";

export default async function NewAuditPage() {
  const { profile } = await requireAuthenticatedUser("/audits/new");
  const activeHotel = await getActiveHotel(null, profile);

  return (
    <NewAuditPageClient
      initialProfile={profile}
      initialHotelId={activeHotel.ok ? activeHotel.hotelId : null}
    />
  );
}
