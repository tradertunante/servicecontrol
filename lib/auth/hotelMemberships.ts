// Roles que puede tener un usuario en un hotel concreto. Debe coincidir con
// sc_can_write_profile / sc_can_manage_profile (migraciones de RLS): superadmin
// no se asigna como membresía, se gestiona aparte.
export const MEMBERSHIP_ROLES = [
  "admin",
  "general_manager",
  "manager",
  "auditor",
  "quality",
  "engineering",
  "it",
  "systems",
  "mystery_shopper",
] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export function normalizeMembershipRole(value: unknown): MembershipRole | null {
  const role = String(value ?? "").trim().toLowerCase();
  return (MEMBERSHIP_ROLES as readonly string[]).includes(role) ? (role as MembershipRole) : null;
}

export type AvailableHotel = {
  id: string;
  name: string;
  role: string;
};

// Orden estable para el selector: primero el hotel activo, luego por nombre.
export function sortAvailableHotels(hotels: AvailableHotel[], activeHotelId: string | null) {
  return [...hotels].sort((a, b) => {
    if (a.id === activeHotelId) return -1;
    if (b.id === activeHotelId) return 1;
    return a.name.localeCompare(b.name, "es");
  });
}
