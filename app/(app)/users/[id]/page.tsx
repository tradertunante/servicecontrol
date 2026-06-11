import { requirePageAccess } from "@/lib/auth/server";

import UserDetailPageClient from "./UserDetailPageClient";

type UserDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserDetailPage(props: UserDetailPageProps) {
  const params = await props.params;
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
