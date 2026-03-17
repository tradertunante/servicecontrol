import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function MyLayout({ children }: { children: ReactNode }) {
  await requireRole(["superadmin", "admin", "manager", "quality", "auditor"], {
    nextPath: "/my",
    redirectTo: "/dashboard",
  });

  return <>{children}</>;
}
