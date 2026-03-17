import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  authorizeRouteRequest,
  hasAreaScopeForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import { readAuditLogs, writeAuditLogs } from "@/lib/auditLogs";
import type { AuditLogEntryInput } from "@/lib/auditLogTypes";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonNoStore(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function getCaller(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["superadmin", "admin", "manager", "quality"],
  });

  if (!caller) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  return {
    ok: true as const,
    profile: {
      id: caller.profile.id,
      hotel_id: caller.profile.hotel_id,
      role: caller.profile.role,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller.ok) return jsonError(caller.error, caller.status);

    const requestedHotelId = request.nextUrl.searchParams.get("hotel_id")?.trim() || null;
    const hotelResult = resolveRouteHotelScope(caller.profile, requestedHotelId);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const hotelId = hotelResult.hotelId;
    const areaId = request.nextUrl.searchParams.get("area_id")?.trim() || "";
    const period = request.nextUrl.searchParams.get("period")?.trim() || "";
    const entityId = request.nextUrl.searchParams.get("entity_id")?.trim() || "";
    const sourceScreen = request.nextUrl.searchParams.get("source_screen")?.trim() || "";
    const entityTypes = (request.nextUrl.searchParams.get("entity_types") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const limit = Math.max(
      1,
      Math.min(100, Number(request.nextUrl.searchParams.get("limit") ?? 40) || 40)
    );

    if (!hotelId) return jsonError("hotel_id es requerido.", 400);

    if (caller.profile.role === "manager") {
      if (!areaId) {
        return jsonError("Los managers deben consultar audit logs por area_id.", 400);
      }

      const hasAccess = await hasAreaScopeForProfile(caller.profile, hotelId, areaId);
      if (!hasAccess) return jsonError("Forbidden: area fuera de alcance.", 403);
    }

    const logs = await readAuditLogs(supabaseAdmin(), {
      hotelId,
      entityTypes,
      entityId: entityId || undefined,
      areaId: areaId || undefined,
      period: period || undefined,
      sourceScreen: sourceScreen || undefined,
      limit,
    });

    return jsonNoStore({ ok: true, logs });
  } catch (error: any) {
    return jsonError(error?.message ?? "No se pudo cargar el historial.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller.ok) return jsonError(caller.error, caller.status);

    const body = await request.json().catch(() => null);
    const entries = (Array.isArray(body?.entries) ? body.entries : []) as AuditLogEntryInput[];

    if (entries.length === 0) return jsonError("No hay entradas para registrar.", 400);

    const sanitized: AuditLogEntryInput[] = [];

    for (const entry of entries) {
      const requestedHotelId = String(entry.hotel_id ?? "").trim() || null;
      const hotelResult = resolveRouteHotelScope(caller.profile, requestedHotelId);
      if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

      const hotelId = hotelResult.hotelId;

      const areaId = String(entry.metadata?.area_id ?? "");
      if (caller.profile.role === "manager") {
        if (!areaId) {
          return jsonError("Los managers deben registrar audit logs con metadata.area_id.", 400);
        }

        const hasAccess = await hasAreaScopeForProfile(caller.profile, hotelId, areaId);
        if (!hasAccess) return jsonError("Forbidden: area fuera de alcance.", 403);
      }

      sanitized.push({
        ...entry,
        hotel_id: hotelId,
        actor_user_id: caller.profile.id,
      });
    }

    await writeAuditLogs(supabaseAdmin(), sanitized);

    return jsonNoStore({ ok: true, count: sanitized.length });
  } catch (error: any) {
    return jsonError(error?.message ?? "No se pudo registrar el historial.", 500);
  }
}
