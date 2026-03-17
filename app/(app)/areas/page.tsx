import { requirePageAccess } from "@/lib/auth/server";

import AreasPageClient from "./AreasPageClient";

export default async function AreasPage() {
  const auth = await requirePageAccess({
    module: "areas",
    requireHotel: true,
    nextPath: "/areas",
    redirectTo: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return <AreasPageClient initialProfile={auth.profile} hotelId={hotelId ?? ""} />;
}
