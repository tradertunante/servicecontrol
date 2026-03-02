// lib/types.ts
// Tipos compartidos en toda la aplicación.
// Importar desde aquí en lugar de definir localmente en cada página.

export type Role = "superadmin" | "admin" | "manager" | "auditor";

export type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};