export type Role =
  | "superadmin"
  | "admin"
  | "general_manager"
  | "manager"
  | "auditor"
  | "quality"
  | "engineering"
  | "it"
  | "systems";

export type AuthorizationModule =
  | "areas"
  | "reports"
  | "admin"
  | "builder"
  | "users"
  | "team"
  | "team_manager"
  | "members";

export type Permission =
  | "areas.view"
  | "areas.manage"
  | "reports.view"
  | "admin.access"
  | "builder.manage"
  | "users.manage"
  | "team.access"
  | "team.manage_assigned_areas"
  | "members.manage";

const MODULE_ROLE_MAP: Record<AuthorizationModule, Role[]> = {
  areas: ["admin", "general_manager", "manager", "auditor", "superadmin", "quality"],
  reports: ["admin", "manager", "auditor", "quality", "superadmin"],
  admin: ["admin", "superadmin"],
  builder: ["admin", "superadmin"],
  users: ["admin", "superadmin"],
  team: ["superadmin", "admin", "manager", "quality", "engineering", "systems", "it"],
  team_manager: ["manager"],
  members: ["manager", "quality", "general_manager", "admin", "superadmin"],
};

const PERMISSION_ROLE_MAP: Record<Permission, Role[]> = {
  "areas.view": MODULE_ROLE_MAP.areas,
  "areas.manage": ["admin", "superadmin"],
  "reports.view": MODULE_ROLE_MAP.reports,
  "admin.access": MODULE_ROLE_MAP.admin,
  "builder.manage": MODULE_ROLE_MAP.builder,
  "users.manage": MODULE_ROLE_MAP.users,
  "team.access": MODULE_ROLE_MAP.team,
  "team.manage_assigned_areas": MODULE_ROLE_MAP.team_manager,
  "members.manage": MODULE_ROLE_MAP.members,
};

const ASSIGNABLE_ROLE_MAP: Record<Role, Role[]> = {
  superadmin: [
    "admin",
    "general_manager",
    "manager",
    "auditor",
    "quality",
    "engineering",
    "it",
    "systems",
  ],
  admin: [
    "admin",
    "general_manager",
    "manager",
    "auditor",
    "quality",
    "engineering",
    "it",
    "systems",
  ],
  general_manager: [],
  manager: [],
  auditor: [],
  quality: [],
  engineering: [],
  it: [],
  systems: [],
};

export function normalizeRole(role: any): Role {
  const r = (role ?? "").toString().toLowerCase().trim();

  if (r === "superadmin") return "superadmin";
  if (r === "admin") return "admin";
  if (r === "general_manager") return "general_manager";
  if (r === "manager") return "manager";
  if (r === "auditor") return "auditor";
  if (r === "quality") return "quality";
  if (r === "engineering") return "engineering";
  if (r === "it") return "it";
  if (r === "systems") return "systems";

  return "auditor";
}

function norm(role: Role | string | null | undefined): string {
  return (role ?? "").toString().toLowerCase().trim();
}

export function isRoleAllowed(
  role: Role | string | null | undefined,
  allowedRoles: readonly Role[]
): boolean {
  const normalized = normalizeRole(role);
  return allowedRoles.includes(normalized);
}

export function getModuleRoles(module: AuthorizationModule): readonly Role[] {
  return MODULE_ROLE_MAP[module];
}

export function canAccessModule(
  role: Role | string | null | undefined,
  module: AuthorizationModule
): boolean {
  return isRoleAllowed(role, MODULE_ROLE_MAP[module]);
}

export function getPermissionRoles(permission: Permission): readonly Role[] {
  return PERMISSION_ROLE_MAP[permission];
}

export function hasPermission(
  role: Role | string | null | undefined,
  permission: Permission
): boolean {
  return isRoleAllowed(role, PERMISSION_ROLE_MAP[permission]);
}

export function getAssignableRoles(
  actorRole: Role | string | null | undefined
): readonly Role[] {
  return ASSIGNABLE_ROLE_MAP[normalizeRole(actorRole)];
}

export function canAssignRole(
  actorRole: Role | string | null | undefined,
  targetRole: Role | string | null | undefined
): boolean {
  return getAssignableRoles(actorRole).includes(normalizeRole(targetRole));
}

export function getDefaultHotelRouteByRole(
  role: Role | string | null | undefined
): "/dashboard" | "/team" | "/my" | "/it" | "/engineering" {
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

  if (r === "engineering") {
    return "/engineering";
  }

  if (r === "systems" || r === "it") {
    return "/it";
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
  return ["superadmin", "admin", "general_manager", "manager", "auditor", "quality"].includes(r);
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
  return r === "engineering" || r === "systems" || r === "it";
}

export const canEditAreas = canManageAreas;
export const canEditTemplates = canManageSetup;
export const canManageTemplates = canManageSetup;
