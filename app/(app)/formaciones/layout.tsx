import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/lib/auth/server";
import { getHotelEnabledPacks } from "@/lib/auth/packs";

export default async function FormacionesLayout({ children }: { children: ReactNode }) {
  const { profile, hotelId } = await requirePageAccess({
    roles: ["superadmin", "admin", "quality", "manager", "general_manager"],
    requireHotel: true,
    nextPath: "/formaciones",
    redirectTo: "/dashboard",
  });

  if (profile.role !== "superadmin") {
    const packs = await getHotelEnabledPacks(hotelId);
    if (!packs.includes("pack3")) redirect("/dashboard");
  }

  return <>{children}</>;
}
