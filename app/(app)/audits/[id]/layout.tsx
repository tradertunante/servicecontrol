import type { ReactNode } from "react";

import { requireAuditRunScope } from "@/lib/auth/server";

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

  return <>{children}</>;
}
