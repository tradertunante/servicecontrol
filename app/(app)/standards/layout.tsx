import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function StandardsLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    roles: ["admin", "superadmin"],
    requireHotel: true,
    nextPath: "/standards",
    redirectTo: "/dashboard",
  });

  return <>{children}</>;
}
