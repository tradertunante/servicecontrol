import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { ADMIN_STEPS } from "@/lib/onboarding/adminSteps";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "admin",
    requireHotel: true,
    nextPath: "/admin",
    redirectTo: "/dashboard",
  });
  return (
    <>
      <ModuleOnboardingTour module="admin" steps={ADMIN_STEPS} />
      {children}
    </>
  );
}
