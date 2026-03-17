import { requirePageAccess } from "@/lib/auth/server";

import UserDetailPageClient from "./UserDetailPageClient";

type UserDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { profile, hotelId } = await requirePageAccess({
    module: "users",
    requireHotel: true,
    nextPath: `/users/${params.id}`,
    redirectTo: "/dashboard",
  });

  return (
    <UserDetailPageClient
      userId={params.id}
      initialProfile={profile}
      scopedHotelId={hotelId}
    />
  );
}
