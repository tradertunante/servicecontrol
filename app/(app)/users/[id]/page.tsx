import { requirePageAccess } from "@/lib/auth/server";

import UserDetailPageClient from "./UserDetailPageClient";

type UserDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const auth = await requirePageAccess({
    module: "users",
    requireHotel: true,
    nextPath: `/users/${params.id}`,
    redirectTo: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return (
    <UserDetailPageClient
      userId={params.id}
      initialProfile={auth.profile}
      scopedHotelId={hotelId ?? ""}
    />
  );
}
