import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminAction =
  | "user_created"
  | "role_changed"
  | "active_changed"
  | "user_deleted";

type LogEntry = {
  hotelId: string;
  actorId: string;
  actorName: string | null;
  targetId: string;
  targetName: string | null;
  action: AdminAction;
  oldValue?: string | null;
  newValue?: string | null;
};

export async function logAdminAction(entry: LogEntry): Promise<void> {
  try {
    await supabaseAdmin()
      .from("admin_audit_log")
      .insert({
        hotel_id:    entry.hotelId,
        actor_id:    entry.actorId,
        actor_name:  entry.actorName,
        target_id:   entry.targetId,
        target_name: entry.targetName,
        action:      entry.action,
        old_value:   entry.oldValue ?? null,
        new_value:   entry.newValue ?? null,
      });
  } catch {
    // Logging failures must never break the main operation.
  }
}