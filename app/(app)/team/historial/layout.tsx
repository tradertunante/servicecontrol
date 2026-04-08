import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { HISTORIAL_STEPS } from "@/lib/onboarding/historialSteps";

export default async function TeamHistoryLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "team_manager",
    requireHotel: true,
    nextPath: "/team/historial",
    redirectTo: "/team/progreso",
  });
  return (
    <>
      <ModuleOnboardingTour module="team-historial" steps={HISTORIAL_STEPS} />
      {children}
    </>
  );
}
