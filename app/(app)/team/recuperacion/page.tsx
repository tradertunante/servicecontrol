"use client";

import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import ReauditsPanel from "../_components/ReauditsPanel";
import TeamPageShell from "../_components/TeamPageShell";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";

export default function TeamRecuperacionPage() {
  const router = useRouter();

  requireRoleOrRedirect(
    ["superadmin", "admin", "manager", "quality"],
    router
  );

  const { profile, profileError, hotelId } = useTeamWorkspace();

  return (
    <TeamPageShell profile={profile} profileError={profileError} activeSection="reaudits">
      <ReauditsPanel profile={profile} hotelId={hotelId} />
    </TeamPageShell>
  );
}
