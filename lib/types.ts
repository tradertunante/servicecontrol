import type { Database } from "@/lib/types/database";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

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

/**
 * Lightweight profile subset used across the app.
 * The full row type is Tables<"profiles"> — use that when you need all columns.
 */
export type Profile = {
  id: string;
  full_name?: string | null;
  role: Role;
  hotel_id: string | null;
  active?: boolean | null;
};
