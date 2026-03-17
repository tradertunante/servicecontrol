import DepartmentCorrectiveActionsPage from "../_components/DepartmentCorrectiveActionsPage";
import { requireDepartmentRouteAccess } from "@/lib/auth/departmentRoutes";

export default async function ItPage() {
  const { profile } = await requireDepartmentRouteAccess("it", "/it");

  return (
    <DepartmentCorrectiveActionsPage
      department="it"
      title="Seguimiento IT"
      description="Acciones correctivas no operativas del departamento de IT."
      userId={profile.id}
    />
  );
}
