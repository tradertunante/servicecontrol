import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/auth/server";

export default async function UsersLayout({ children }: { children: ReactNode }) {
  await requirePageAccess({
    module: "users",
    requireHotel: true,
    nextPath: "/users",
    redirectTo: "/dashboard",
  });
  return <>{children}</>;
}
