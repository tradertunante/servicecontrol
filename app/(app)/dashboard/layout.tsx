import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    roles: ["admin", "general_manager", "quality", "superadmin"],
    requireHotel: true,
    nextPath: "/dashboard",
  });

  return <>{children}</>;
}
