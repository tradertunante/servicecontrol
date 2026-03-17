import { requirePageAccess } from "@/lib/auth/server";

import NewUserPageClient from "./NewUserPageClient";

export default async function NewUserPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "users",
    requireHotel: true,
    nextPath: "/users/new",
    redirectTo: "/dashboard",
  });

  return <NewUserPageClient initialProfile={profile} hotelId={hotelId} />;
}
