import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function AreasLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("areas", { nextPath: "/areas", redirectTo: "/dashboard" });
  return <>{children}</>;
}
