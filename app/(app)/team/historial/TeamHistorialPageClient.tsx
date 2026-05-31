"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { Profile } from "@/lib/types";
import type { PeriodKey } from "@/app/(app)/areas/[areaId]/_lib/areaTypes";

import TeamPageShell from "../_components/TeamPageShell";
import ManagerAreaWorkspace from "../_components/ManagerAreaWorkspace";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";

export default function TeamHistorialPageClient({
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
    if (selectedAreaId === "ALL") return;
    if (selectedAreaId && managerAreaOptions.some((area) => area.id === selectedAreaId)) return;
    router.replace(`/team/historial?area=${managerAreaOptions[0].id}`);
  }, [managerAreaOptions, router, selectedAreaId]);

  const areaLabel =
    selectedAreaId === "ALL"
      ? "Todas las áreas"
      : activeArea
        ? `${activeArea.name}${activeArea.type ? ` · ${activeArea.type}` : ""}`
        : null;

  const historyFilters =
    searchParams.get("template") || searchParams.get("period") || searchParams.get("fail_q") || searchParams.get("fail_cls")
      ? {
          templateFilter: searchParams.get("template") ?? "ALL",
          period: (searchParams.get("period") ?? "THIS_MONTH") as PeriodKey,
          questionId: searchParams.get("fail_q") ?? undefined,
          classification: searchParams.get("fail_cls") ?? undefined,
        }
      : null;

  return (
    <TeamPageShell
      profile={profile}
      profileError={profileError}
      activeSection="history"
      areaLabel={areaLabel}
    >
      <ManagerAreaWorkspace
        mode="history"
        profileRole={profile?.role}
        hotelId={initialHotelId}
        areasLoading={managerAreasLoading}
        areasError={managerAreasError}
        areaOptions={managerAreaOptions}
        selectedAreaId={selectedAreaId === "ALL" ? "ALL" : (activeArea?.id ?? "")}
        onSelectArea={(areaId) => router.replace(`/team/historial?area=${areaId}`)}
        historyFilters={historyFilters}
        onOpenHistory={() => {}}
      />
    </TeamPageShell>
  );
}
