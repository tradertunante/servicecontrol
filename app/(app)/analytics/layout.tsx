import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/lib/auth/server";
import { getHotelEnabledPacks } from "@/lib/auth/packs";

export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["admin", "manager", "superadmin"],
    requireHotel: true,
    nextPath: "/analytics",
    redirectTo: "/dashboard",
  });

  if (profile.role !== "superadmin") {
    const packs = await getHotelEnabledPacks(hotelId);
    if (!packs.includes("pack2")) redirect("/dashboard");
  }

  return <>{children}</>;
}
