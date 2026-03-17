import { requirePageAccess } from "@/lib/auth/server";

import DashboardPageClient from "./DashboardPageClient";

export default async function DashboardPage() {
  const auth = await requirePageAccess({
    roles: ["admin", "general_manager", "quality", "superadmin"],
    requireHotel: true,
    nextPath: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return <DashboardPageClient initialProfile={auth.profile} initialHotelId={hotelId} />;
}
