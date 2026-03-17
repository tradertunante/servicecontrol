import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function BuilderLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "builder",
    requireHotel: true,
    nextPath: "/builder",
    redirectTo: "/dashboard",
  });
  return <>{children}</>;
}
