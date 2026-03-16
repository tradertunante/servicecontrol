"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import CorrectiveActionsPanel from "../_components/CorrectiveActionsPanel";
import TeamPageShell from "../_components/TeamPageShell";
import { useTeamWorkspace } from "../_hooks/useTeamWorkspace";
import { getDepartmentRedirectTarget } from "../../_lib/departmentAccess";

export default function TeamFormacionesPage() {
  const router = useRouter();

  requireRoleOrRedirect(
    ["superadmin", "admin", "manager", "quality", "engineering", "systems", "it"],
    router
  );

  const { profile, profileError, hotelId } = useTeamWorkspace();

  useEffect(() => {
    if (!profile) return;
    if (profile.role === "engineering" || profile.role === "systems" || profile.role === "it") {
      router.replace(getDepartmentRedirectTarget(profile.role, null));
    }
  }, [profile, router]);

  if (profile && (profile.role === "engineering" || profile.role === "systems" || profile.role === "it")) {
    return null;
  }

  return (
    <TeamPageShell profile={profile} profileError={profileError} activeSection="actions">
      <>
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "16px",
            fontWeight: 600,
          }}
        >
          Under construction
        </div>
        <CorrectiveActionsPanel profile={profile} hotelId={hotelId} />
      </>
    </TeamPageShell>
  );
}
