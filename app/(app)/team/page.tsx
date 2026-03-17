import { redirect } from "next/navigation";

import { requirePageAccess } from "@/lib/auth/server";
import { getDepartmentRedirectTarget } from "../_lib/departmentAccess";

type TeamPageProps = {
  searchParams?: {
    tab?: string;
  };
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const { profile } = await requirePageAccess({
    module: "team",
    requireHotel: true,
    nextPath: "/team",
    redirectTo: "/dashboard",
  });

  const requestedTab = searchParams?.tab;

  if (requestedTab === "actions") {
    redirect("/formaciones");
  }

  if (requestedTab === "reaudits") {
    redirect("/team/recuperacion");
  }

  if (profile.role === "engineering" || profile.role === "systems" || profile.role === "it") {
    redirect(getDepartmentRedirectTarget(profile.role, null));
  }

  if (profile.role === "manager") {
    if (requestedTab === "history") {
      redirect("/team/historial");
    }

    if (requestedTab === "templates") {
      redirect("/team/templates");
    }

    redirect("/team/general");
  }

  redirect("/team/progreso");
}
