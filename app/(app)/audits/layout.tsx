import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function AuditsLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin", "admin", "manager", "auditor", "quality"], {
    nextPath: "/audits",
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
