import { requirePageAccess } from "@/lib/auth/server";

import NewTemplatePageClient from "./NewTemplatePageClient";

type NewTemplatePageProps = {
  searchParams?: {
    area_id?: string;
  };
};

export default async function NewTemplatePage({ searchParams }: NewTemplatePageProps) {
  const auth = await requirePageAccess({
    module: "builder",
    requireHotel: true,
    nextPath: "/builder/new",
    redirectTo: "/dashboard",
  });
  const hotelId = "hotelId" in auth ? auth.hotelId : auth.profile.hotel_id;

  return (
    <NewTemplatePageClient
      initialProfile={auth.profile}
      hotelId={hotelId ?? ""}
      initialAreaId={searchParams?.area_id ?? null}
    />
  );
}
