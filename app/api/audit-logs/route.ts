import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";
import { readAuditLogs, writeAuditLogs } from "@/lib/auditLogs";
import type { AuditLogEntryInput } from "@/lib/auditLogTypes";

type CallerRole = "superadmin" | "admin" | "manager" | "quality";

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

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function normalizeRole(input: unknown) {
  return String(input ?? "").trim().toLowerCase();
}

async function getCaller(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) return { ok: false as const, error: "No autorizado.", status: 401 };

  const client = supabaseWithToken(token);
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, hotel_id, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, error: "Perfil invalido.", status: 403 };
  }

  if (profile.active === false) {
    return { ok: false as const, error: "Usuario desactivado.", status: 403 };
  }

  const role = normalizeRole(profile.role) as CallerRole;
  if (!["superadmin", "admin", "manager", "quality"].includes(role)) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  return {
    ok: true as const,
    client,
    profile: {
      id: String(profile.id),
      hotel_id: String(profile.hotel_id ?? ""),
      role,
    },
  };
}

async function managerHasAreaAccess(
  client: ReturnType<typeof supabaseWithToken>,
  userId: string,
  hotelId: string,
  areaId: string
) {
  const { data, error } = await client
    .from("user_area_access")
    .select("area_id")
    .eq("user_id", userId)
    .eq("hotel_id", hotelId)
    .eq("area_id", areaId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.area_id);
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller.ok) return jsonError(caller.error, caller.status);

    const hotelId = request.nextUrl.searchParams.get("hotel_id")?.trim() || caller.profile.hotel_id;
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

    if (caller.profile.role !== "superadmin" && hotelId !== caller.profile.hotel_id) {
      return jsonError("Forbidden: hotel fuera de alcance.", 403);
    }

    if (caller.profile.role === "manager" && areaId) {
      const hasAccess = await managerHasAreaAccess(
        caller.client,
        caller.profile.id,
        hotelId,
        areaId
      );

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
      const hotelId = String(entry.hotel_id ?? "");
      if (!hotelId) return jsonError("Cada log requiere hotel_id.", 400);

      if (caller.profile.role !== "superadmin" && hotelId !== caller.profile.hotel_id) {
        return jsonError("Forbidden: hotel fuera de alcance.", 403);
      }

      const areaId = String(entry.metadata?.area_id ?? "");
      if (caller.profile.role === "manager" && areaId) {
        const hasAccess = await managerHasAreaAccess(
          caller.client,
          caller.profile.id,
          hotelId,
          areaId
        );

        if (!hasAccess) return jsonError("Forbidden: area fuera de alcance.", 403);
      }

      sanitized.push({
        ...entry,
        actor_user_id: caller.profile.id,
      });
    }

    await writeAuditLogs(supabaseAdmin(), sanitized);

    return jsonNoStore({ ok: true, count: sanitized.length });
  } catch (error: any) {
    return jsonError(error?.message ?? "No se pudo registrar el historial.", 500);
  }
}
