import { requirePageAccess } from "@/lib/auth/server";

import MembersModule from "./_components/MembersModule";

export default async function MembersPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "members",
    requireHotel: true,
    nextPath: "/members",
    redirectTo: "/dashboard",
  });

  return <MembersModule initialHotelId={hotelId} initialProfile={profile} />;
}
