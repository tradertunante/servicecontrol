export type Role =
  | "superadmin"
  | "admin"
  | "general_manager"
  | "manager"
  | "auditor"
  | "quality"
  | "engineering"
  | "systems";

export function normalizeRole(role: any): Role {
  const r = (role ?? "").toString().toLowerCase().trim();

  if (r === "superadmin") return "superadmin";
  if (r === "admin") return "admin";
  if (r === "general_manager") return "general_manager";
  if (r === "manager") return "manager";
  if (r === "auditor") return "auditor";
  if (r === "quality") return "quality";
  if (r === "engineering") return "engineering";
  if (r === "systems") return "systems";

  return "auditor";
}

function norm(role: Role | string | null | undefined): string {
  return (role ?? "").toString().toLowerCase().trim();
}

export function getDefaultHotelRouteByRole(
  role: Role | string | null | undefined
): "/dashboard" | "/team" | "/my" {
  const r = norm(role);

  if (
    r === "superadmin" ||
    r === "admin" ||
    r === "quality" ||
    r === "general_manager"
  ) {
    return "/dashboard";
  }

  if (r === "manager") {
    return "/team";
  }

  if (r === "auditor") {
    return "/my";
  }

  return "/my";
}

export function canStartAudits(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return ["superadmin", "admin", "manager", "auditor", "quality"].includes(r);
}

export function canRunAudits(role: Role | string | null | undefined): boolean {
  return canStartAudits(role);
}

export function canManageAreas(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin";
}

export function canManageUsers(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin";
}

export function canSubmitAudit(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return ["superadmin", "admin", "auditor", "quality"].includes(r);
}

export function canManageSetup(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin";
}

export function isQualityRole(role: Role | string | null | undefined): boolean {
  return norm(role) === "quality";
}

export function auditChannel(role: Role | string | null | undefined): "quality" | "internal" {
  return norm(role) === "quality" ? "quality" : "internal";
}

export function isNonOperationalRole(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "engineering" || r === "systems";
}

export const canEditAreas = canManageAreas;
export const canEditTemplates = canManageSetup;
export const canManageTemplates = canManageSetup;
