import type { ReactNode } from "react";
import { requireModuleAccess } from "@/lib/auth/server";

export default async function CorrectiveActionsLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("team", { nextPath: "/corrective-actions", redirectTo: "/dashboard" });
  return <>{children}</>;
}