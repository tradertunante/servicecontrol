"use client";

import { useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import TrainingsModule from "./_components/TrainingsModule";

export default function FormacionesPage() {
  const router = useRouter();

  requireRoleOrRedirect(["admin", "quality", "manager", "general_manager"], router);

  return <TrainingsModule />;
}
