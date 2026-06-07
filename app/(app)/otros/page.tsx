import DepartmentCorrectiveActionsPage from "../_components/DepartmentCorrectiveActionsPage";
import { requireDepartmentRouteAccess } from "@/lib/auth/departmentRoutes";

export default async function OtrosPage() {
  const { profile } = await requireDepartmentRouteAccess("otros", "/otros");

  return (
    <DepartmentCorrectiveActionsPage
      department="otros"
      title="Seguimiento Otros"
      description="Backlog operativo de FAILs submitidos asignados a estándares generales (decoración, digital, room, etc.)."
      userId={profile.id}
    />
  );
}