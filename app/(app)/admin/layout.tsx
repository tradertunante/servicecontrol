import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("admin", { nextPath: "/admin", redirectTo: "/dashboard" });
  return <>{children}</>;
}
