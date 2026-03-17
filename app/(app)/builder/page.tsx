import HotelHeader from "@/app/components/HotelHeader";
import BuilderShell from "@/app/(app)/builder/_components/BuilderShell";
import { requirePageAccess } from "@/lib/auth/server";

export default async function BuilderPage() {
  const auth = await requirePageAccess({
    module: "builder",
    requireHotel: true,
    nextPath: "/builder",
    redirectTo: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return (
    <main style={{ padding: 24, paddingTop: 96 }}>
      <HotelHeader />
      <BuilderShell profile={auth.profile} hotelIdInUse={hotelId ?? ""} />
    </main>
  );
}
