import { requireHotelScope } from "@/lib/auth/server";

import MyDashboardPageClient from "./MyDashboardPageClient";

export default async function MyDashboardPage() {
  const { profile, hotelId } = await requireHotelScope(undefined, {
    nextPath: "/my",
  });

  return <MyDashboardPageClient initialProfile={profile} initialHotelId={hotelId} />;
}
