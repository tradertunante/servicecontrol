import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "admin",
    requireHotel: true,
    nextPath: "/admin",
    redirectTo: "/dashboard",
  });
  return <>{children}</>;
}
