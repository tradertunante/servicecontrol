import { requirePermission } from "@/lib/auth/server";

import NewAreaPageClient from "./NewAreaPageClient";

export default async function NewAreaPage() {
  const { profile } = await requirePermission("areas.manage", {
    nextPath: "/areas/new",
    redirectTo: "/areas",
  });

  return <NewAreaPageClient profile={profile} />;
}
