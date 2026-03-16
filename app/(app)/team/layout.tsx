import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function TeamLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("team", { nextPath: "/team", redirectTo: "/dashboard" });
  return <>{children}</>;
}
