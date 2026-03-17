import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function TeamHistoryLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("team_manager", {
    nextPath: "/team/historial",
    redirectTo: "/team/progreso",
  });
  return <>{children}</>;
}
