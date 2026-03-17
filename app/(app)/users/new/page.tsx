import { requirePageAccess } from "@/lib/auth/server";

import NewUserPageClient from "./NewUserPageClient";

export default async function NewUserPage() {
  const auth = await requirePageAccess({
    module: "users",
    requireHotel: true,
    nextPath: "/users/new",
    redirectTo: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return <NewUserPageClient initialProfile={auth.profile} hotelId={hotelId ?? ""} />;
}
