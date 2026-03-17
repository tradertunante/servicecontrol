import { requirePageAccess } from "@/lib/auth/server";

import NewTemplatePageClient from "./NewTemplatePageClient";

type NewTemplatePageProps = {
  searchParams?: {
    area_id?: string;
  };
};

export default async function NewTemplatePage({ searchParams }: NewTemplatePageProps) {
  const { profile, hotelId } = await requirePageAccess({
    module: "builder",
    requireHotel: true,
    nextPath: "/builder/new",
    redirectTo: "/dashboard",
  });

  return (
    <NewTemplatePageClient
      initialProfile={profile}
      hotelId={hotelId}
      initialAreaId={searchParams?.area_id ?? null}
    />
  );
}
