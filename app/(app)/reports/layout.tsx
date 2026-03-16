import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("reports", { nextPath: "/reports", redirectTo: "/areas" });
  return <>{children}</>;
}
