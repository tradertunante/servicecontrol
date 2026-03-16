import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function MembersLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("members", { nextPath: "/members", redirectTo: "/dashboard" });
  return <>{children}</>;
}
