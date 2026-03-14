"use client";

import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import MembersModule from "./_components/MembersModule";

export default function MembersPage() {
  const router = useRouter();

  requireRoleOrRedirect(["manager", "quality", "general_manager", "admin", "superadmin"], router);

  return <MembersModule />;
}
