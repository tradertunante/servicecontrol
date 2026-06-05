import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth/server";
import MysteryShopperDashboard from "./MysteryShopperDashboard";

export default async function MysteryShopperPage({
  searchParams,
}: {
  searchParams: { shopper_id?: string };
}) {
  const { profile, hotelId } = await requirePageAccess({
    module: "mystery_shopper",
    requireHotel: true,
    nextPath: "/mystery-shopper",
  });

  // Admin viewing a specific shopper
  const shopperId =
    profile.role !== "mystery_shopper"
      ? (searchParams.shopper_id ?? null)
      : profile.id;

  if (profile.role !== "mystery_shopper" && !shopperId) {
    redirect("/admin?tab=mystery-shoppers");
  }

  return (
    <MysteryShopperDashboard
      hotelId={hotelId}
      profile={profile}
      shopperId={shopperId!}
    />
  );
}