import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function AuditsLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin", "admin", "general_manager", "manager", "auditor", "quality", "mystery_shopper"], {
    nextPath: "/audits",
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
