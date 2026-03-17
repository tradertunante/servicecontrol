import { requireHotelScope } from "@/lib/auth/server";

import NewAuditPageClient from "./NewAuditPageClient";

export default async function NewAuditPage() {
  const { profile, hotelId } = await requireHotelScope(undefined, {
    nextPath: "/audits/new",
  });

  return (
    <NewAuditPageClient
      initialProfile={profile}
      initialHotelId={hotelId}
    />
  );
}
