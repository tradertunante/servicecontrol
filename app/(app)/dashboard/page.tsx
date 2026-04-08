import { requirePageAccess } from "@/lib/auth/server";
import { getHotelEnabledPacks } from "@/lib/auth/packs";
import type { PackCode } from "@/lib/auth/packs";

import DashboardPageClient from "./DashboardPageClient";

export default async function DashboardPage() {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["admin", "general_manager", "quality", "superadmin"],
    requireHotel: true,
    nextPath: "/dashboard",
  });

  let enabledPacks: PackCode[] = ["base", "pack1", "pack2", "pack3"];
  if (profile.role !== "superadmin" && hotelId) {
    enabledPacks = await getHotelEnabledPacks(hotelId);
  }

  return (
    <DashboardPageClient
      initialProfile={profile}
      initialHotelId={hotelId}
      enabledPacks={enabledPacks}
    />
  );
}
