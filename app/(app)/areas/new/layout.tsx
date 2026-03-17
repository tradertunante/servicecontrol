import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/server";

export default async function NewAreaLayout({ children }: { children: ReactNode }) {
  await requirePermission("areas.manage", { nextPath: "/areas/new", redirectTo: "/areas" });
  return <>{children}</>;
}
