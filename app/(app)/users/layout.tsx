import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function UsersLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("users", { nextPath: "/users", redirectTo: "/dashboard" });
  return <>{children}</>;
}
