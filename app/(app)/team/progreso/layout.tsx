import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { PROGRESS_STEPS } from "@/lib/onboarding/progressSteps";

export default async function TeamProgressLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    roles: ["superadmin", "admin", "manager", "quality"],
    requireHotel: true,
    nextPath: "/team/progreso",
    redirectTo: "/team",
  });
  return (
    <>
      <ModuleOnboardingTour module="team-progreso" steps={PROGRESS_STEPS} />
      {children}
    </>
  );
}
