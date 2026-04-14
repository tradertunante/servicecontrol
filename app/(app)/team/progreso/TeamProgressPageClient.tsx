"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const reportBtnStyle = {
  width: "100%",
  marginTop: 8,
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.94)",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const reportBtnDisabledStyle = {
  ...reportBtnStyle,
  opacity: 0.55,
  cursor: "not-allowed",
} as const;

export default function TeamProgressPageClient({
  initialProfile,
  initialHotelId,
}: {
  initialProfile: Profile;
  initialHotelId: string;
}) {
  const router = useRouter();
  const t = useTranslations("app.team.progress");

  const { profile, profileError, hotelId, managerAreaOptions } = useTeamWorkspace({
    initialProfile,
    initialHotelId,
  });
  const [selectedPeriod, setSelectedPeriod] = useState<TeamPeriodKey>("monthly");

  const reportTargetAreaId = managerAreaOptions[0]?.id ?? null;
  const reportHref =
    selectedPeriod === "monthly" && reportTargetAreaId
      ? `/reports/monthly/area/${reportTargetAreaId}`
      : selectedPeriod === "weekly" && reportTargetAreaId
      ? `/reports/weekly/area/${reportTargetAreaId}`
      : null;
  const reportLabel =
    selectedPeriod === "monthly"
      ? t("reportMonthly")
      : selectedPeriod === "weekly"
      ? t("reportWeekly")
      : t("reportUnavailable");

  const periodControl = useMemo(
    () => (
      <div>
        <select
          style={selectStyle}
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value as TeamPeriodKey)}
        >
          <option value="daily">{t("periodDaily")}</option>
          <option value="weekly">{t("periodWeekly")}</option>
          <option value="monthly">{t("periodMonthly")}</option>
        </select>

        <button
          type="button"
          disabled={!reportHref}
          onClick={() => {
            if (!reportHref) return;
            router.push(reportHref);
          }}
          title={
            reportHref
              ? t("reportTooltip")
              : t("reportTooltipDaily")
          }
          style={reportHref ? reportBtnStyle : reportBtnDisabledStyle}
        >
          {reportLabel}
        </button>
      </div>
    ),
    [reportHref, reportLabel, router, selectedPeriod]
  );

  return (
    <TeamPageShell
      profile={profile}
      profileError={profileError}
      activeSection="progress"
      periodControl={periodControl}
    >
      <TeamSummaryTab selectedPeriod={selectedPeriod} hotelId={hotelId} initialProfile={initialProfile} />
    </TeamPageShell>
  );
}
