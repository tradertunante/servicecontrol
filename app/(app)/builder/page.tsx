import HotelHeader from "@/app/components/HotelHeader";
import BuilderShell from "@/app/(app)/builder/_components/BuilderShell";
import { requirePageAccess } from "@/lib/auth/server";

export default async function BuilderPage() {
  const { profile, hotelId } = await requirePageAccess({
    module: "builder",
    requireHotel: true,
    nextPath: "/builder",
    redirectTo: "/dashboard",
  });

  return (
    <main style={{ padding: 24, paddingTop: 96 }}>
      <HotelHeader />
      <BuilderShell profile={profile} hotelIdInUse={hotelId} />
    </main>
  );
}
