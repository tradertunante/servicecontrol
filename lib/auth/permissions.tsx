export type Role =
  | "superadmin"
  | "admin"
  | "general_manager"
  | "manager"
  | "auditor"
  | "quality"
  | "engineering"
  | "it"
  | "systems"
  | "mystery_shopper";

export type AuthorizationModule =
  | "areas"
  | "reports"
  | "admin"
  | "builder"
  | "users"
  | "team"
  | "team_manager"
  | "members"
  | "mystery_shopper";

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
  reports: ["admin", "general_manager", "manager", "auditor", "quality", "superadmin", "mystery_shopper"],
  admin: ["admin", "superadmin"],
  builder: ["admin", "superadmin"],
  users: ["admin", "superadmin"],
  team: ["superadmin", "admin", "general_manager", "manager", "quality", "engineering", "systems", "it"],
  team_manager: ["superadmin", "admin", "general_manager", "manager", "quality"],
  members: ["manager", "quality", "general_manager", "admin", "superadmin"],
  mystery_shopper: ["mystery_shopper", "admin", "superadmin"],
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
    "mystery_shopper",
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
    "mystery_shopper",
  ],
  general_manager: [],
  manager: [],
  auditor: [],
  quality: [],
  engineering: [],
  it: [],
  systems: [],
  mystery_shopper: [],
};

export const ROLE_LABELS: Record<Role, string> = {
  superadmin:      "Superadmin",
  admin:           "Administrador",
  general_manager: "Director General",
  manager:         "Manager",
  auditor:         "Auditor",
  quality:         "Quality",
  engineering:     "Engineering",
  it:              "IT",
  systems:         "Systems",
  mystery_shopper: "Mystery Shopper",
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
  if (r === "mystery_shopper") return "mystery_shopper";

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
): "/dashboard" | "/team" | "/areas" | "/my" | "/it" | "/engineering" | "/mystery-shopper" {
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
    return "/areas";
  }

  if (r === "engineering") {
    return "/engineering";
  }

  if (r === "systems" || r === "it") {
    return "/it";
  }

  if (r === "mystery_shopper") {
    return "/mystery-shopper";
  }

  return "/my";
}

export function canStartAudits(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return ["superadmin", "admin", "manager", "auditor", "quality", "mystery_shopper"].includes(r);
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
  return ["superadmin", "admin", "general_manager", "manager", "auditor", "quality", "mystery_shopper"].includes(r);
}

export function canManageSetup(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "superadmin" || r === "admin";
}

export function isQualityRole(role: Role | string | null | undefined): boolean {
  return norm(role) === "quality";
}

export function auditChannel(role: Role | string | null | undefined): "quality" | "internal" {
  const r = norm(role);
  return r === "quality" || r === "mystery_shopper" ? "quality" : "internal";
}

export function isNonOperationalRole(role: Role | string | null | undefined): boolean {
  const r = norm(role);
  return r === "engineering" || r === "systems" || r === "it";
}

export const canEditAreas = canManageAreas;
export const canEditTemplates = canManageSetup;
export const canManageTemplates = canManageSetup;
