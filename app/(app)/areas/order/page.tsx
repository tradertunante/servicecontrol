import { getServerSelectedHotelId, requirePermission } from "@/lib/auth/server";

import OrderAreasPageClient from "./OrderAreasPageClient";

export default async function OrderAreasPage() {
  const auth = await requirePermission("areas.manage", {
    nextPath: "/areas/order",
    redirectTo: "/areas",
  });

  const activeHotelId =
    auth.profile.role === "superadmin"
      ? getServerSelectedHotelId() ?? ""
      : auth.profile.hotel_id ?? "";

  return (
    <OrderAreasPageClient initialProfile={auth.profile} initialActiveHotelId={activeHotelId} />
  );
}
