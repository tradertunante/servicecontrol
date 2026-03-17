import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function TeamProgressLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin", "admin", "manager", "quality"], {
    nextPath: "/team/progreso",
    redirectTo: "/team",
  });
  return <>{children}</>;
}
