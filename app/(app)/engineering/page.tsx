import DepartmentCorrectiveActionsPage from "../_components/DepartmentCorrectiveActionsPage";
import { requireDepartmentRouteAccess } from "@/lib/auth/departmentRoutes";

export default async function EngineeringPage() {
  const { profile } = await requireDepartmentRouteAccess("engineering", "/engineering");

  return (
    <DepartmentCorrectiveActionsPage
      department="engineering"
      title="Seguimiento Engineering"
      description="Acciones correctivas no operativas del departamento de Engineering."
      userId={profile.id}
    />
  );
}
