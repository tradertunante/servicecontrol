"use client";

import type { Profile } from "@/lib/types";

import ReauditsPanel from "../_components/ReauditsPanel";
import TeamPageShell from "../_components/TeamPageShell";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";

export default function TeamRecuperacionPageClient({
  initialProfile,
  initialHotelId,
}: {
  initialProfile: Profile;
  initialHotelId: string;
}) {
  const { profile, profileError, hotelId } = useTeamWorkspace({
    initialProfile,
    initialHotelId,
  });

  return (
    <TeamPageShell profile={profile} profileError={profileError} activeSection="reaudits">
      <ReauditsPanel profile={profile} hotelId={hotelId} />
    </TeamPageShell>
  );
}
