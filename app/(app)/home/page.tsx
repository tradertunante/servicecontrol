import { redirect } from "next/navigation";

import { getDefaultHotelRouteByRole } from "@/lib/auth/permissions";
import { requireAuthenticatedUser, requireHotelScope } from "@/lib/auth/server";

export default async function HomeRedirectPage() {
  const { profile } = await requireAuthenticatedUser("/home");

  if (profile.role === "superadmin") {
    await requireHotelScope(undefined, { nextPath: "/home" });
  }

  redirect(getDefaultHotelRouteByRole(profile.role));
}
