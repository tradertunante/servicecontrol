import { redirect } from "next/navigation";

import { getDefaultHotelRouteByRole } from "@/lib/auth/permissions";
import { getActiveHotel, requireAuthenticatedUser } from "@/lib/auth/server";

export default async function HomeRedirectPage() {
  const { profile } = await requireAuthenticatedUser("/home");

  if (profile.role === "superadmin") {
    const activeHotel = await getActiveHotel(null, profile);
    if (!activeHotel.ok) {
      redirect("/superadmin");
    }
  }

  redirect(getDefaultHotelRouteByRole(profile.role));
}
