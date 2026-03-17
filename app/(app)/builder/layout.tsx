import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function BuilderLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("builder", { nextPath: "/builder", redirectTo: "/dashboard" });
  return <>{children}</>;
}
