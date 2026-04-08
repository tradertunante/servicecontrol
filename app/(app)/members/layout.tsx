import type { ReactNode } from "react";

import { requireModuleAccess } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { MEMBERS_STEPS } from "@/lib/onboarding/membersSteps";

export default async function MembersLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("members", { nextPath: "/members", redirectTo: "/dashboard" });
  return (
    <>
      <ModuleOnboardingTour module="members" steps={MEMBERS_STEPS} />
      {children}
    </>
  );
}
