import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/server";

export default async function OrderAreasLayout({ children }: { children: ReactNode }) {
  await requirePermission("areas.manage", { nextPath: "/areas/order", redirectTo: "/areas" });
  return <>{children}</>;
}
