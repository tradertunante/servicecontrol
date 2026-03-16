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

export type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};
