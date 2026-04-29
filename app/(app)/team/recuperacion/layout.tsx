import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/lib/auth/server";
import { getHotelEnabledPacks } from "@/lib/auth/packs";

export default async function TeamRecoveryLayout({ children }: { children: ReactNode }) {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["superadmin", "admin", "manager", "quality"],
    requireHotel: true,
    nextPath: "/team/recuperacion",
    redirectTo: "/team",
  });

  if (profile.role !== "superadmin") {
    const packs = await getHotelEnabledPacks(hotelId);
    if (!packs.includes("pack2")) redirect("/team/general");
  }

  return <>{children}</>;
}
