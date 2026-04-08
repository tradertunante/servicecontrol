import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { AUDITAR_STEPS } from "@/lib/onboarding/auditarSteps";

export default async function TeamTemplatesLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "team_manager",
    requireHotel: true,
    nextPath: "/team/templates",
    redirectTo: "/team/progreso",
  });
  return (
    <>
      <ModuleOnboardingTour module="team-auditar" steps={AUDITAR_STEPS} />
      {children}
    </>
  );
}
