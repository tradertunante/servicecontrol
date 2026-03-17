import { requirePageAccess } from "@/lib/auth/server";

import UsersPageClient from "./UsersPageClient";

export default async function UsersPage() {
  const auth = await requirePageAccess({
    module: "users",
    requireHotel: true,
    nextPath: "/users",
    redirectTo: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return <UsersPageClient initialProfile={auth.profile} hotelId={hotelId ?? ""} />;
}
