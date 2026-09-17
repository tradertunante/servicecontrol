import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendOverdueCorrectiveActionsEmail } from "@/lib/email/overdueCorrectiveActionsEmail";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { logger } from "@/lib/logger";

// Vercel cron invokes with GET + Authorization: Bearer ${CRON_SECRET};
// x-cron-secret is kept for manual server-to-server triggers.
function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

/**
 * GET /api/corrective-actions/check-overdue
 * Entry point for Vercel cron (Monday 8am UTC — same cadence as the weekly report).
 * Dispatches one POST per active hotel so each runs in its own serverless invocation.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return jsonError("No autorizado.", 401);

  const admin = supabaseAdmin();
  const { data: hotels, error } = await admin.from("hotels").select("id").eq("is_active", true);
  if (error) return jsonDbError(error);
  const hotelIds = (hotels ?? []).map((h) => h.id);
  if (hotelIds.length === 0) return NextResponse.json({ ok: true, dispatched: 0 });

  const origin = new URL(request.url).origin;
  const secret = process.env.CRON_SECRET!;

  const dispatches = Promise.allSettled(
    hotelIds.map((id) =>
      fetch(`${origin}/api/corrective-actions/check-overdue`, {
        method: "POST",
        headers: { "x-cron-secret": secret, "Content-Type": "application/json" },
        body: JSON.stringify({ hotel_id: id }),
      })
    )
  );

  waitUntil(dispatches);
  return NextResponse.json({ ok: true, dispatched: hotelIds.length }, { status: 202 });
}

/**
 * POST /api/corrective-actions/check-overdue
 * Manual admin/GM/quality trigger, or server-to-server with x-cron-secret (single hotel via hotel_id).
 * Notifies the assignee of each overdue corrective action (email + in-app notification);
 * unassigned overdue actions are digested to the hotel's admins and general managers.
 */
export async function POST(request: NextRequest) {
  const viaCron = isAuthorizedCronRequest(request);

  let hotelId: string;
  if (viaCron) {
    const body = await request.json().catch(() => null);
    const id = typeof body?.hotel_id === "string" ? body.hotel_id.trim() : "";
    if (!id) return jsonError("hotel_id es obligatorio.", 400);
    hotelId = id;
  } else {
    const caller = await authorizeRouteRequest(request, {
      roles: ["superadmin", "admin", "general_manager", "quality"],
    });
    if (!caller) return jsonError("No autorizado.", 401);
    const hotelResult = await resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);
    hotelId = hotelResult.hotelId;
  }

  try {
    const result = await processOverdueForHotel(hotelId);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    await logger.error("corrective_actions_overdue_check_failed", { hotelId, error: message });
    return jsonDbError(null, "Error inesperado al revisar acciones vencidas.");
  }
}

type OverdueRow = {
  id: string;
  title: string;
  due_date: string;
  assigned_to: string | null;
  area_id: string | null;
};

async function processOverdueForHotel(hotelId: string) {
  const admin = supabaseAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://servicecontrol.io";
  const link = `${appUrl}/corrective-actions`;

  const today = new Date().toISOString().slice(0, 10);

  const { data: hotel } = await admin.from("hotels").select("name").eq("id", hotelId).maybeSingle();
  const hotelName = hotel?.name || "Hotel";

  const { data: overdue, error } = await admin
    .from("audit_corrective_actions")
    .select("id,title,due_date,assigned_to,area_id")
    .eq("hotel_id", hotelId)
    .in("status", ["open", "in_progress"])
    .not("due_date", "is", null)
    .lt("due_date", today);

  if (error) throw error;

  const rows = (overdue ?? []) as OverdueRow[];
  if (rows.length === 0) return { overdue: 0, notified: 0 };

  const areaIds = Array.from(new Set(rows.map((r) => r.area_id).filter(Boolean))) as string[];
  const { data: areas } = areaIds.length
    ? await admin.from("areas").select("id,name").in("id", areaIds)
    : { data: [] as { id: string; name: string }[] };
  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name]));

  const daysOverdue = (dueDate: string) =>
    Math.max(1, Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000));

  const assignedIds = Array.from(new Set(rows.map((r) => r.assigned_to).filter(Boolean))) as string[];
  const { data: assignedProfiles } = assignedIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", assignedIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileById = new Map((assignedProfiles ?? []).map((p) => [p.id, p]));

  const byAssignee = new Map<string, OverdueRow[]>();
  const unassigned: OverdueRow[] = [];
  for (const row of rows) {
    if (row.assigned_to) {
      const bucket = byAssignee.get(row.assigned_to) ?? [];
      bucket.push(row);
      byAssignee.set(row.assigned_to, bucket);
    } else {
      unassigned.push(row);
    }
  }

  if (unassigned.length > 0) {
    const { data: managers } = await admin
      .from("profiles")
      .select("id,full_name,email")
      .eq("hotel_id", hotelId)
      .in("role", ["admin", "general_manager"]);
    for (const manager of managers ?? []) {
      byAssignee.set(manager.id, [...(byAssignee.get(manager.id) ?? []), ...unassigned]);
      if (!profileById.has(manager.id)) profileById.set(manager.id, manager);
    }
  }

  let notified = 0;
  for (const [profileId, items] of byAssignee) {
    const profile = profileById.get(profileId);
    if (!profile?.email) continue;

    const emailItems = items.map((it) => ({
      title: it.title,
      areaName: it.area_id ? areaNameById.get(it.area_id) ?? null : null,
      dueDate: it.due_date,
      daysOverdue: daysOverdue(it.due_date),
      link,
    }));

    try {
      await sendOverdueCorrectiveActionsEmail({
        to: profile.email,
        recipientName: profile.full_name,
        hotelName,
        items: emailItems,
      });
      await admin.rpc("notify_user", {
        p_hotel_id: hotelId,
        p_user_id: profileId,
        p_type: "corrective_action",
        p_title:
          items.length === 1
            ? "1 acción correctiva vencida"
            : `${items.length} acciones correctivas vencidas`,
        p_body: `Revisa el detalle en Acciones correctivas.`,
        p_link: "/corrective-actions",
      });
      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      await logger.error("corrective_actions_overdue_notify_failed", {
        hotelId,
        profileId,
        error: message,
      });
    }
  }

  return { overdue: rows.length, notified };
}
