import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function TeamGeneralLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "team_manager",
    requireHotel: true,
    nextPath: "/team/general",
    redirectTo: "/team/progreso",
  });
  return <>{children}</>;
}
