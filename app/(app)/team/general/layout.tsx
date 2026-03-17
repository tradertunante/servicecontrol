import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function TeamGeneralLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("team_manager", {
    nextPath: "/team/general",
    redirectTo: "/team/progreso",
  });
  return <>{children}</>;
}
