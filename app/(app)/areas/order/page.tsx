import { requireHotelScope } from "@/lib/auth/server";

import OrderAreasPageClient from "./OrderAreasPageClient";

export default async function OrderAreasPage() {
  const { profile, hotelId } = await requireHotelScope(undefined, {
    nextPath: "/areas/order",
    redirectTo: "/areas",
    permission: "areas.manage",
  });

  return (
    <OrderAreasPageClient initialProfile={profile} initialActiveHotelId={hotelId} />
  );
}
