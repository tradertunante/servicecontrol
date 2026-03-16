import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";

export default async function TeamTemplatesLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("team_manager", {
    nextPath: "/team/templates",
    redirectTo: "/team/progreso",
  });
  return <>{children}</>;
}
