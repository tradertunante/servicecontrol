import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLogEntryInput, AuditLogRecord } from "@/lib/auditLogTypes";

type AuditLogsFilter = {
  hotelId: string;
  entityTypes?: string[];
  entityId?: string;
  areaId?: string;
  period?: string;
  sourceScreen?: string;
  limit?: number;
};

function normalizeEntry(entry: AuditLogEntryInput) {
  return {
    hotel_id: entry.hotel_id,
    actor_user_id: entry.actor_user_id ?? null,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    action: entry.action,
    old_value: entry.old_value ?? null,
    new_value: entry.new_value ?? null,
    metadata: entry.metadata ?? null,
  };
}

export async function writeAuditLogs(
  admin: SupabaseClient,
  entries: AuditLogEntryInput[]
) {
  if (entries.length === 0) return;

  const { error } = await admin.from("audit_logs").insert(entries.map(normalizeEntry));

  if (error) throw error;
}

export async function readAuditLogs(
  admin: SupabaseClient,
  filter: AuditLogsFilter
): Promise<AuditLogRecord[]> {
  let query = admin
    .from("audit_logs")
    .select(
      "id, hotel_id, actor_user_id, entity_type, entity_id, action, old_value, new_value, metadata, created_at"
    )
    .eq("hotel_id", filter.hotelId)
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 40);

  if (filter.entityTypes && filter.entityTypes.length > 0) {
    query = query.in("entity_type", filter.entityTypes);
  }

  if (filter.entityId) {
    query = query.eq("entity_id", filter.entityId);
  }

  if (filter.areaId) {
    query = query.contains("metadata", { area_id: filter.areaId });
  }

  if (filter.period) {
    query = query.contains("metadata", { period: filter.period });
  }

  if (filter.sourceScreen) {
    query = query.contains("metadata", { source_screen: filter.sourceScreen });
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as AuditLogRecord[];
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_user_id).filter(Boolean))
  ) as string[];

  const actorNames = new Map<string, string | null>();

  if (actorIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);

    if (profilesError) throw profilesError;

    for (const profile of profiles ?? []) {
      actorNames.set(String(profile.id), (profile.full_name as string | null) ?? null);
    }
  }

  return rows.map((row) => ({
    ...row,
    actor_name: row.actor_user_id ? actorNames.get(row.actor_user_id) ?? null : null,
  }));
}
