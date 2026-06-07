import { normalizeRole, type Role } from "@/lib/auth/permissions";

export type DepartmentCode = "it" | "engineering" | "otros" | null;
export type DepartmentRouteScope = "department" | "area" | "none";

function canOpenDepartmentRouteAsHotelReader(role: unknown): boolean {
  const normalizedRole = normalizeRole(role);
  return (
    normalizedRole === "admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "quality" ||
    normalizedRole === "general_manager"
  );
}

function canOpenDepartmentRouteAsAreaReader(role: unknown): boolean {
  return normalizeRole(role) === "manager";
}

export function normalizeDepartmentCode(input: unknown): DepartmentCode {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "engineering") return "engineering";
  if (value === "it" || value === "systems") return "it";
  if (value === "otros") return "otros";
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
  const canOpenAsHotelReader = canOpenDepartmentRouteAsHotelReader(role);
  const canOpenAsAreaReader = canOpenDepartmentRouteAsAreaReader(role);

  if (normalizedAssignedDepartment === routeDepartment) {
    return "department";
  }

  if (canOpenAsHotelReader) {
    return "department";
  }

  if (canOpenAsAreaReader) {
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
    canOpenDepartmentRouteAsHotelReader(role) ||
    canOpenDepartmentRouteAsAreaReader(role)
  );
}

export function getDepartmentRedirectTarget(role: unknown, assignedDepartmentCode: unknown): string {
  const normalizedRole: Role = normalizeRole(role);
  const departmentCode = resolveDepartmentCode(normalizedRole, assignedDepartmentCode);

  if (departmentCode === "it") return "/it";
  if (departmentCode === "engineering") return "/engineering";
  if (normalizedRole === "auditor") return "/areas";
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
