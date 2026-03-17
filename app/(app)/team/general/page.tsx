"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TeamPageShell from "../_components/TeamPageShell";
import ManagerAreaWorkspace, {
  type ManagerAreaHistoryFilters,
} from "../_components/ManagerAreaWorkspace";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";

export default function TeamGeneralPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    profile,
    profileError,
    managerAreasLoading,
    managerAreasError,
    managerAreaOptions,
  } = useTeamWorkspace();

  const selectedAreaId = searchParams.get("area") ?? "";
  const activeArea =
    managerAreaOptions.find((area) => area.id === selectedAreaId) ?? managerAreaOptions[0] ?? null;

  useEffect(() => {
    if (!managerAreaOptions.length) return;
    if (selectedAreaId && managerAreaOptions.some((area) => area.id === selectedAreaId)) return;
    router.replace(`/team/general?area=${managerAreaOptions[0].id}`);
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
        mode="dashboard"
        profileRole={profile?.role}
        areasLoading={managerAreasLoading}
        areasError={managerAreasError}
        areaOptions={managerAreaOptions}
        selectedAreaId={activeArea?.id ?? ""}
        onSelectArea={(areaId) => router.replace(`/team/general?area=${areaId}`)}
        historyFilters={null}
        onOpenHistory={(filters: Exclude<ManagerAreaHistoryFilters, null>) => {
          const params = new URLSearchParams({ area: activeArea?.id ?? "", template: filters.templateFilter, period: filters.period });
          if (filters.questionId) params.set("fail_q", filters.questionId);
          if (filters.classification) params.set("fail_cls", filters.classification);
          router.push(`/team/historial?${params.toString()}`);
        }}
      />
    </TeamPageShell>
  );
}
