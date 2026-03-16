"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import Card from "@/components/ui/Card";
import { useTeamWorkspace } from "./_hooks/useTeamWorkspace";
import { getDepartmentRedirectTarget } from "../_lib/departmentAccess";

export default function TeamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  requireRoleOrRedirect(
    ["superadmin", "admin", "manager", "quality", "engineering", "systems", "it"],
    router
  );

  const { profile, profileError } = useTeamWorkspace();

  useEffect(() => {
    if (!profile) return;

    const requestedTab = searchParams.get("tab");

    if (requestedTab === "actions") {
      router.replace("/formaciones");
      return;
    }

    if (requestedTab === "reaudits") {
      router.replace("/team/recuperacion");
      return;
    }

    if (requestedTab === "history" && profile.role === "manager") {
      router.replace("/team/historial");
      return;
    }

    if (requestedTab === "area" && profile.role === "manager") {
      router.replace("/team/general");
      return;
    }

    if (requestedTab === "templates" && profile.role === "manager") {
      router.replace("/team/templates");
      return;
    }

    if (
      profile.role === "engineering" ||
      profile.role === "systems" ||
      profile.role === "it"
    ) {
      router.replace(getDepartmentRedirectTarget(profile.role, null));
      return;
    }

    if (profile.role === "manager") {
      router.replace("/team/general");
      return;
    }

    router.replace("/team/progreso");
  }, [profile, router, searchParams]);

  return (
    <div style={{ padding: "24px 14px" }}>
      {profileError ? (
        <Card style={{ border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Error:</b> {profileError}
        </Card>
      ) : (
        <div style={{ fontWeight: 900 }}>Redirigiendo…</div>
      )}
    </div>
  );
}
