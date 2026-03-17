import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function TeamHistoryLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "team_manager",
    requireHotel: true,
    nextPath: "/team/historial",
    redirectTo: "/team/progreso",
  });
  return <>{children}</>;
}
