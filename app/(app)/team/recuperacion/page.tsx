"use client";

import ReauditsPanel from "../_components/ReauditsPanel";
import TeamPageShell from "../_components/TeamPageShell";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";

export default function TeamRecuperacionPage() {
  const { profile, profileError, hotelId } = useTeamWorkspace();

  return (
    <TeamPageShell profile={profile} profileError={profileError} activeSection="reaudits">
      <ReauditsPanel profile={profile} hotelId={hotelId} />
    </TeamPageShell>
  );
}
