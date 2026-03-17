import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function AreasLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "areas",
    requireHotel: true,
    nextPath: "/areas",
    redirectTo: "/dashboard",
  });
  return <>{children}</>;
}
