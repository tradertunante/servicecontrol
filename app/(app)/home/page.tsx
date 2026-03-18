import { redirect } from "next/navigation";

import { getDefaultHotelRouteByRole } from "@/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/lib/auth/server";

export default async function HomeRedirectPage() {
  const { profile } = await requireAuthenticatedUser("/home");

  if (profile.role === "superadmin") {
    redirect("/superadmin");
  }

  redirect(getDefaultHotelRouteByRole(profile.role));
}
