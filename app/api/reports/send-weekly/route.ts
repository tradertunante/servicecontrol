import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWeeklyReportEmail } from "@/lib/email/weeklyReportEmail";
import { jsonError, jsonDbError } from "@/lib/api/response";

/**
 * POST /api/reports/send-weekly
 * Sends weekly report emails for a hotel.
 * Called by cron (Vercel or Supabase Edge Function) with CRON_SECRET header,
 * or by admin users manually.
 */
export async function POST(request: NextRequest) {
  // Auth: either cron secret or admin user
  const cronSecret = request.headers.get("x-cron-secret");
  const isAuthorizedCron =
    cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  let hotelIds: string[] = [];

  if (isAuthorizedCron) {
    // Cron mode: send for all hotels with active subscriptions
    const admin = supabaseAdmin();
    const { data: subs, error } = await admin
      .from("report_subscriptions")
      .select("hotel_id")
      .eq("report_type", "weekly")
      .eq("active", true);

    if (error) return jsonDbError(error);
    hotelIds = Array.from(new Set((subs ?? []).map((s) => s.hotel_id)));
  } else {
    // Manual mode: require hotel_id in body
    const body = await request.json().catch(() => null);
    const hotelId = typeof body?.hotel_id === "string" ? body.hotel_id.trim() : "";
    if (!hotelId) return jsonError("hotel_id es obligatorio.", 400);
    hotelIds = [hotelId];
  }

  const admin = supabaseAdmin();
  const results: { hotel: string; sent: number; errors: string[] }[] = [];

  for (const hotelId of hotelIds) {
    const hotelResult: { hotel: string; sent: number; errors: string[] } = {
      hotel: hotelId,
      sent: 0,
      errors: [],
    };

    // Get hotel name
    const { data: hotel } = await admin
      .from("hotels")
      .select("name")
      .eq("id", hotelId)
      .single();

    const hotelName = hotel?.name || "Hotel";

    // Get subscribers
    const { data: subs } = await admin
      .from("report_subscriptions")
      .select("email")
      .eq("hotel_id", hotelId)
      .eq("report_type", "weekly")
      .eq("active", true);

    const emails = (subs ?? []).map((s) => s.email).filter(Boolean);
    if (emails.length === 0) {
      hotelResult.errors.push("Sin suscriptores activos.");
      results.push(hotelResult);
      continue;
    }

    // Calculate week range (last 7 days)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekLabel = `${weekStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} - ${now.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`;

    // Get areas
    const { data: areas } = await admin
      .from("areas")
      .select("id,name")
      .eq("hotel_id", hotelId);

    // Get runs from last week
    const { data: runs } = await admin
      .from("audit_runs")
      .select("area_id,score")
      .eq("hotel_id", hotelId)
      .eq("status", "submitted")
      .is("archived_at", null)
      .gte("executed_at", weekStart.toISOString())
      .lte("executed_at", now.toISOString());

    const areaMap = new Map<string, { name: string; scores: number[]; count: number }>();
    for (const area of areas ?? []) {
      areaMap.set(area.id, { name: area.name, scores: [], count: 0 });
    }

    let allScores: number[] = [];
    for (const run of runs ?? []) {
      if (run.score == null) continue;
      allScores.push(run.score);
      const entry = areaMap.get(run.area_id);
      if (entry) {
        entry.scores.push(run.score);
        entry.count++;
      }
    }

    const areaData = Array.from(areaMap.values())
      .filter((a) => a.count > 0)
      .map((a) => ({
        name: a.name,
        score: a.scores.reduce((s, v) => s + v, 0) / a.scores.length,
        auditsCount: a.count,
      }));

    const overallScore =
      allScores.length > 0
        ? allScores.reduce((s, v) => s + v, 0) / allScores.length
        : 0;

    // Send to each subscriber
    for (const email of emails) {
      try {
        await sendWeeklyReportEmail({
          to: email,
          hotelName,
          weekLabel,
          areas: areaData,
          overallScore,
          totalAudits: allScores.length,
        });
        hotelResult.sent++;
      } catch (err) {
        hotelResult.errors.push(
          `${email}: ${err instanceof Error ? err.message : "Error desconocido"}`
        );
      }
    }

    results.push(hotelResult);
  }

  const totalSent = results.reduce((s, r) => s + r.sent, 0);

  return NextResponse.json({
    ok: true,
    totalSent,
    results,
  });
}
