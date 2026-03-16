import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function TeamRecoveryLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin", "admin", "manager", "quality"], {
    nextPath: "/team/recuperacion",
    redirectTo: "/team",
  });
  return <>{children}</>;
}
