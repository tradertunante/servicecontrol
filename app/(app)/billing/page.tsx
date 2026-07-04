import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/server";
import { getActiveSubscription } from "@/lib/billing/getActiveSubscription";
import BillingPageClient from "./BillingPageClient";

export default async function BillingPage() {
  const { profile } = await requireAuthenticatedUser("/billing");

  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  if (!isAdmin) {
    // Trials y ex-trials que ya pagaron (dueños de billing account) también
    // necesitan ver su facturación: es la página de retorno del checkout.
    const billing = await getActiveSubscription(profile.id);
    if (!billing.has_account && !profile.is_trial) {
      redirect("/dashboard");
    }
  }

  return <BillingPageClient />;
}
