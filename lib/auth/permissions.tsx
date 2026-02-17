// lib/auth/permissions.ts

export type Role = "superadmin" | "admin" | "manager" | "auditor";

/**
 * ✅ La usa app/page.tsx
 * Convierte cualquier string a uno de los roles válidos (o "auditor" por defecto)
 */
export function normalizeRole(role: any): Role {
  const r = (role ?? "").toString().toLowerCase().trim();

  if (r === "superadmin") return "superadmin";
  if (r === "admin") return "admin";
  if (r === "manager") return "manager";
  if (r === "auditor") return "auditor";

  return "auditor";
}

function norm(role: Role | string | null | undefined): string {
  return (role ?? "").toString().toLowerCase().trim();
}

/**
 * Ver / iniciar auditorías
 */
export function canStartAudits(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin" || r === "manager" || r === "auditor";
}

/**
 * Alias usado en otras páginas
 */
export function canRunAudits(role: Role | string | null | undefined): boolean {
  return canStartAudits(role);
}

/**
 * Crear/editar áreas
 */
export function canManageAreas(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin";
}

/**
 * ✅ Gestionar usuarios
 */
export function canManageUsers(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin";
}

/**
 * Enviar auditoría
 */
export function canSubmitAudit(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin" || r === "auditor";
}

/**
 * Admin setup (templates/preguntas/secciones)
 */
export function canManageSetup(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin";
}

/**
 * Aliases por compatibilidad
 */
export const canEditAreas = canManageAreas;
export const canEditTemplates = canManageSetup;
export const canManageTemplates = canManageSetup;
