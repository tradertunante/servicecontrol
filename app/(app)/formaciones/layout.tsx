import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/server";

export default async function FormacionesLayout({ children }: { children: ReactNode }) {
  await requireRole(["admin", "quality", "manager", "general_manager"], {
    nextPath: "/formaciones",
    redirectTo: "/dashboard",
  });

  return <>{children}</>;
}
