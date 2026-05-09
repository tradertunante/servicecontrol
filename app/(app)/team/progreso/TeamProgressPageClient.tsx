"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { Profile } from "@/lib/types";

import TeamPageShell from "../_components/TeamPageShell";
import TeamSummaryTab from "../_components/TeamSummaryTab";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";
import type { TeamPeriodKey } from "../_hooks/useTeamData";

const selectStyle = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.18)",
  color: "white",
  outline: "none",
} as const;

export default function TeamProgressPageClient({
  initialProfile,
  initialHotelId,
}: {
  initialProfile: Profile;
  initialHotelId: string;
}) {
  const t = useTranslations("app.team.progress");

  const { profile, profileError, hotelId, managerAreaOptions } = useTeamWorkspace({
    initialProfile,
    initialHotelId,
  });
  const [selectedPeriod, setSelectedPeriod] = useState<TeamPeriodKey>("monthly");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const periodControl = useMemo(
    () => (
      <select
        style={selectStyle}
        value={selectedPeriod}
        onChange={(e) => setSelectedPeriod(e.target.value as TeamPeriodKey)}
      >
        <option value="daily">{t("periodDaily")}</option>
        <option value="weekly">{t("periodWeekly")}</option>
        <option value="monthly">{t("periodMonthly")}</option>
      </select>
    ),
    [selectedPeriod, t]
  );

  return (
    <TeamPageShell
      profile={profile}
      profileError={profileError}
      activeSection="progress"
      periodControl={periodControl}
    >
      <TeamSummaryTab
        selectedPeriod={selectedPeriod}
        hotelId={hotelId}
        initialProfile={initialProfile}
        selectedAreaId={selectedAreaId}
        areaOptions={managerAreaOptions}
        onSelectArea={(id: string | null) => setSelectedAreaId(id)}
      />
    </TeamPageShell>
  );
}