import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { TEAM_STEPS } from "@/lib/onboarding/teamSteps";

export default async function TeamLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("team", { nextPath: "/team", redirectTo: "/dashboard" });
  return (
    <>
      <ModuleOnboardingTour module="team" steps={TEAM_STEPS} />
      {children}
    </>
  );
}
