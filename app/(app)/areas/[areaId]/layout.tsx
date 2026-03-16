import type { ReactNode } from "react";

import { requireAreaScope } from "@/lib/auth/server";

export default async function AreaScopedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { areaId: string };
}) {
  await requireAreaScope(params.areaId, {
    module: "areas",
    nextPath: `/areas/${params.areaId}`,
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
