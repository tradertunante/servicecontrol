import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function TeamTemplatesLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "team_manager",
    requireHotel: true,
    nextPath: "/team/templates",
    redirectTo: "/team/progreso",
  });
  return <>{children}</>;
}
