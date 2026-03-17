import { requirePageAccess } from "@/lib/auth/server";

import UsersPageClient from "./UsersPageClient";

export default async function UsersPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "users",
    requireHotel: true,
    nextPath: "/users",
    redirectTo: "/dashboard",
  });

  return <UsersPageClient initialProfile={profile} hotelId={hotelId} />;
}
