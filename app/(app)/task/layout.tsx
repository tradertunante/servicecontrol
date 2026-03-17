import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function TaskLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin", "admin", "manager", "quality", "auditor"], {
    nextPath: "/task",
    redirectTo: "/dashboard",
  });

  return <>{children}</>;
}
