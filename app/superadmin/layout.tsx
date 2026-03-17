import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin"], {
    nextPath: "/superadmin",
    redirectTo: "/dashboard",
  });

  return <>{children}</>;
}
