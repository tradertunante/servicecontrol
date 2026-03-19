import { normalizeRole, type Role } from "@/lib/auth/permissions";

export type DepartmentCode = "it" | "engineering" | null;
export type DepartmentRouteScope = "department" | "area" | "none";

function canOpenDepartmentRouteAsReader(role: unknown): boolean {
  const normalizedRole = normalizeRole(role);
  return (
    normalizedRole === "admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "quality" ||
    normalizedRole === "general_manager" ||
    normalizedRole === "manager"
  );
}

export function normalizeDepartmentCode(input: unknown): DepartmentCode {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "engineering") return "engineering";
  if (value === "it" || value === "systems") return "it";
  return null;
}

export function resolveDepartmentCode(role: unknown, assignedDepartmentCode: unknown): DepartmentCode {
  const normalizedDepartment = normalizeDepartmentCode(assignedDepartmentCode);
  if (normalizedDepartment) return normalizedDepartment;

  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "engineering") return "engineering";
  if (normalizedRole === "systems" || normalizedRole === "it") return "it";
  return null;
}

export function getDepartmentRouteScope(
  routeDepartment: Exclude<DepartmentCode, null>,
  role: unknown,
  assignedDepartmentCode: unknown,
  hasAreaScope: boolean
): DepartmentRouteScope {
  const normalizedAssignedDepartment = normalizeDepartmentCode(assignedDepartmentCode);
  const canOpenAsReader = canOpenDepartmentRouteAsReader(role);

  if (normalizedAssignedDepartment === routeDepartment) {
    return "department";
  }

  if (canOpenAsReader) {
    return "area";
  }

  if (normalizedAssignedDepartment === "it" || normalizedAssignedDepartment === "engineering") {
    return "none";
  }

  if (hasAreaScope) {
    return "area";
  }

  return "none";
}

export function canAccessDepartmentRoute(
  routeDepartment: Exclude<DepartmentCode, null>,
  role: unknown,
  assignedDepartmentCode: unknown
): boolean {
  return (
    resolveDepartmentCode(role, assignedDepartmentCode) === routeDepartment ||
    canOpenDepartmentRouteAsReader(role)
  );
}

export function getDepartmentRedirectTarget(role: unknown, assignedDepartmentCode: unknown): string {
  const normalizedRole: Role = normalizeRole(role);
  const departmentCode = resolveDepartmentCode(normalizedRole, assignedDepartmentCode);

  if (departmentCode === "it") return "/it";
  if (departmentCode === "engineering") return "/engineering";
  if (normalizedRole === "auditor") return "/my";
  if (normalizedRole === "manager") return "/team";
  if (
    normalizedRole === "quality" ||
    normalizedRole === "admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "general_manager"
  ) {
    return "/dashboard";
  }

  return "/";
}
