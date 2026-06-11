import type { ReactNode } from "react";

import { requireAreaScope } from "@/lib/auth/server";

export default async function AreaScopedLayout(
  props: {
    children: ReactNode;
    params: Promise<{ areaId: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  await requireAreaScope(params.areaId, {
    module: "areas",
    nextPath: `/areas/${params.areaId}`,
    redirectTo: "/areas",
  });

  return <>{children}</>;
}
