import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  await requireRole(["admin", "manager", "superadmin"], {
    nextPath: "/analytics",
    redirectTo: "/dashboard",
  });

  return <>{children}</>;
}
