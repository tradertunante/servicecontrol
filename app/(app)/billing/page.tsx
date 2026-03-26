import { requirePageAccess } from "@/lib/auth/server";
import BillingPageClient from "./BillingPageClient";

export default async function BillingPage() {
  await requirePageAccess({
    roles: ["admin", "superadmin"],
    nextPath: "/billing",
    redirectTo: "/dashboard",
  });

  return <BillingPageClient />;
}
