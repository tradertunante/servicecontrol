import { requireHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import MyDashboardPageClient from "./MyDashboardPageClient";

export default async function MyDashboardPage() {
  const { profile, hotelId } = await requireHotelScope(undefined, {
    nextPath: "/my",
  });

  const admin = supabaseAdmin();
  const { data: hotel } = await admin
    .from("hotels")
    .select("name")
    .eq("id", hotelId)
    .maybeSingle();

  const hotelName = hotel?.name ?? null;

  return (
    <MyDashboardPageClient
      initialProfile={profile}
      initialHotelId={hotelId}
      initialHotelName={hotelName}
    />
  );
}
