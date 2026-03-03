export type Role = "superadmin" | "admin" | "manager" | "auditor" | "quality";

export function normalizeRole(role: any): Role {
  const r = (role ?? "").toString().toLowerCase().trim();
  if (r === "superadmin") return "superadmin";
  if (r === "admin") return "admin";
  if (r === "manager") return "manager";
  if (r === "auditor") return "auditor";
  if (r === "quality") return "quality";
  return "auditor";
}

function norm(role: Role | string | null | undefined): string {
  return (role ?? "").toString().toLowerCase().trim();
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

/** Devuelve true si el rol es del canal Quality */
export function isQualityRole(role: Role | string | null | undefined): boolean {
  return norm(role) === "quality";
}

/** Canal de auditoría según el rol del usuario */
export function auditChannel(role: Role | string | null | undefined): "quality" | "internal" {
  return norm(role) === "quality" ? "quality" : "internal";
}

export const canEditAreas = canManageAreas;
export const canEditTemplates = canManageSetup;
export const canManageTemplates = canManageSetup;