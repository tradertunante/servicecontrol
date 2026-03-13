"use client";

import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import CorrectiveActionsPanel from "../_components/CorrectiveActionsPanel";
import TeamPageShell from "../_components/TeamPageShell";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";

export default function TeamFormacionesPage() {
  const router = useRouter();

  requireRoleOrRedirect(
    ["superadmin", "admin", "manager", "quality", "engineering", "systems"],
    router
  );

  const { profile, profileError, hotelId } = useTeamWorkspace();

  return (
    <TeamPageShell profile={profile} profileError={profileError} activeSection="actions">
      <CorrectiveActionsPanel profile={profile} hotelId={hotelId} />
    </TeamPageShell>
  );
}
