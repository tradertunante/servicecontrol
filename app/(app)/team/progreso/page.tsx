"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
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

export default function TeamProgressPage() {
  const router = useRouter();

  requireRoleOrRedirect(
    ["superadmin", "admin", "manager", "quality"],
    router
  );

  const { profile, profileError, hotelId } = useTeamWorkspace();
  const [selectedPeriod, setSelectedPeriod] = useState<TeamPeriodKey>("monthly");

  const periodControl = useMemo(
    () => (
      <select
        style={selectStyle}
        value={selectedPeriod}
        onChange={(e) => setSelectedPeriod(e.target.value as TeamPeriodKey)}
      >
        <option value="daily">Diario</option>
        <option value="weekly">Semanal</option>
        <option value="monthly">Mensual</option>
      </select>
    ),
    [selectedPeriod]
  );

  return (
    <TeamPageShell
      profile={profile}
      profileError={profileError}
      activeSection="progress"
      periodControl={periodControl}
    >
      <TeamSummaryTab selectedPeriod={selectedPeriod} hotelId={hotelId} />
    </TeamPageShell>
  );
}
