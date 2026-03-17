import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function StandardsLayout({ children }: { children: ReactNode }) {
  await requireRole(["admin", "superadmin"], {
    nextPath: "/standards",
    redirectTo: "/dashboard",
  });

  return <>{children}</>;
}
