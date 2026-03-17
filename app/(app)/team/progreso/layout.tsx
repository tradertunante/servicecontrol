import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function TeamProgressLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    roles: ["superadmin", "admin", "manager", "quality"],
    requireHotel: true,
    nextPath: "/team/progreso",
    redirectTo: "/team",
  });
  return <>{children}</>;
}
