"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { Profile } from "@/lib/types";

import TeamPageShell from "../_components/TeamPageShell";
import ManagerAreaWorkspace from "../_components/ManagerAreaWorkspace";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";

export default function TeamTemplatesPageClient({
  initialProfile,
  initialHotelId,
}: {
  initialProfile: Profile;
  initialHotelId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    profile,
    profileError,
    managerAreasLoading,
    managerAreasError,
    managerAreaOptions,
  } = useTeamWorkspace({ initialProfile, initialHotelId });

  const selectedAreaId = searchParams.get("area") ?? "";
  const activeArea =
    managerAreaOptions.find((area) => area.id === selectedAreaId) ?? managerAreaOptions[0] ?? null;

  useEffect(() => {
    if (!managerAreaOptions.length) return;
    if (selectedAreaId && managerAreaOptions.some((area) => area.id === selectedAreaId)) return;
    router.replace(`/team/templates?area=${managerAreaOptions[0].id}`);
  }, [managerAreaOptions, router, selectedAreaId]);

  const areaLabel = activeArea ? `${activeArea.name}${activeArea.type ? ` · ${activeArea.type}` : ""}` : null;

  return (
    <TeamPageShell
      profile={profile}
      profileError={profileError}
      activeSection="general"
      areaLabel={areaLabel}
    >
      <ManagerAreaWorkspace
        mode="templates"
        profileRole={profile?.role}
        hotelId={initialHotelId}
        areasLoading={managerAreasLoading}
        areasError={managerAreasError}
        areaOptions={managerAreaOptions}
        selectedAreaId={activeArea?.id ?? ""}
        onSelectArea={(areaId) => router.replace(`/team/templates?area=${areaId}`)}
        historyFilters={null}
        onOpenHistory={() => {}}
      />
    </TeamPageShell>
  );
}
