import type { ReactNode } from "react";

import { requireAuditRunScope } from "@/lib/auth/server";
import ModuleOnboardingTour from "@/app/components/ModuleOnboardingTour";
import { AUDIT_SESSION_STEPS } from "@/lib/onboarding/auditarSteps";

export default async function AuditRunLayout(
  props: {
    children: ReactNode;
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

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
