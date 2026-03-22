import DepartmentCorrectiveActionsPage from "../_components/DepartmentCorrectiveActionsPage";
import { requireDepartmentRouteAccess } from "@/lib/auth/departmentRoutes";

export default async function ItPage() {
  const { profile } = await requireDepartmentRouteAccess("it", "/it");

  return (
    <DepartmentCorrectiveActionsPage
      department="it"
      title="Seguimiento IT"
      description="Backlog operativo de FAILs submitidos asignados al departamento de IT."
      userId={profile.id}
    />
  );
}
