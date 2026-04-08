import type { ReactNode } from "react";

import { requireAuditRunScope } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { AUDIT_SESSION_STEPS } from "@/lib/onboarding/auditarSteps";

export default async function AuditRunLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  await requireAuditRunScope(params.id, {
    nextPath: `/audits/${params.id}`,
    redirectTo: "/areas",
  });

  return (
    <>
      <ModuleOnboardingTour module="audit-session" steps={AUDIT_SESSION_STEPS} />
      {children}
    </>
  );
}
