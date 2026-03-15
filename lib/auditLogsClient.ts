import { supabase } from "@/lib/supabaseClient";
import type { AuditLogEntryInput, AuditLogRecord } from "@/lib/auditLogTypes";

type FetchAuditLogsParams = {
  hotelId: string;
  entityTypes?: string[];
  entityId?: string;
  areaId?: string;
  period?: string;
  sourceScreen?: string;
  limit?: number;
};

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? "";
}

export async function postAuditLogEntries(entries: AuditLogEntryInput[]) {
  if (entries.length === 0) return;

  const token = await getAccessToken();
  if (!token) throw new Error("No autorizado.");

  const response = await fetch("/api/audit-logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ entries }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "No se pudo registrar el historial.");
  }
}

export async function fetchAuditLogs(params: FetchAuditLogsParams) {
  const token = await getAccessToken();
  if (!token) throw new Error("No autorizado.");

  const search = new URLSearchParams();
  search.set("hotel_id", params.hotelId);

  if (params.entityTypes && params.entityTypes.length > 0) {
    search.set("entity_types", params.entityTypes.join(","));
  }

  if (params.entityId) search.set("entity_id", params.entityId);
  if (params.areaId) search.set("area_id", params.areaId);
  if (params.period) search.set("period", params.period);
  if (params.sourceScreen) search.set("source_screen", params.sourceScreen);
  if (params.limit) search.set("limit", String(params.limit));

  const response = await fetch(`/api/audit-logs?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "No se pudo cargar el historial.");
  }

  const body = (await response.json()) as { logs: AuditLogRecord[] };
  return body.logs ?? [];
}
