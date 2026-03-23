import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMonthlyReportEmail } from "@/lib/email/monthlyReportEmail";
import { jsonError, jsonDbError } from "@/lib/api/response";

/**
 * POST /api/reports/send-monthly
 * Sends monthly report emails to subscribers with frequency='monthly'.
 * Respects scope (all_areas / specific_areas) and channel filters.
 * Called by Vercel cron (1st of month 8am UTC) or manually by admin.
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const isAuthorizedCron =
    cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  let hotelIds: string[] = [];

  if (isAuthorizedCron) {
    const admin = supabaseAdmin();
    const { data: subs, error } = await admin
      .from("report_subscriptions")
      .select("hotel_id")
      .eq("frequency", "monthly")
      .eq("active", true);

    if (error) return jsonDbError(error);
    hotelIds = Array.from(new Set((subs ?? []).map((s) => s.hotel_id)));
  } else {
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

    const { data: hotel } = await admin
      .from("hotels")
      .select("name")
      .eq("id", hotelId)
      .single();

    const hotelName = hotel?.name || "Hotel";

    // Get monthly subscribers
    const { data: subs } = await admin
      .from("report_subscriptions")
      .select("email,scope,area_ids,channel")
      .eq("hotel_id", hotelId)
      .eq("frequency", "monthly")
      .eq("active", true);

    if (!subs || subs.length === 0) {
      hotelResult.errors.push("Sin suscriptores activos.");
      results.push(hotelResult);
      continue;
    }

    // Month range (previous calendar month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const monthLabel = monthStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    // Get areas
    const { data: areas } = await admin
      .from("areas")
      .select("id,name")
      .eq("hotel_id", hotelId);

    // Get runs from previous month
    const { data: runs } = await admin
      .from("audit_runs")
      .select("area_id,score,audit_channel")
      .eq("hotel_id", hotelId)
      .eq("status", "submitted")
      .is("archived_at", null)
      .gte("executed_at", monthStart.toISOString())
      .lte("executed_at", monthEnd.toISOString());

    for (const sub of subs) {
      // Filter by channel
      const filteredRuns = (runs ?? []).filter((run) => {
        const ch = run.audit_channel ?? "internal";
        return sub.channel === "all" || sub.channel === ch;
      });

      // Filter by area scope
      const scopedRuns = filteredRuns.filter((run) => {
        if (sub.scope === "specific_areas" && Array.isArray(sub.area_ids)) {
          return sub.area_ids.includes(run.area_id);
        }
        return true;
      });

      if (scopedRuns.length === 0) continue;

      const areaMap = new Map<string, { name: string; scores: number[]; count: number }>();
      for (const area of areas ?? []) {
        areaMap.set(area.id, { name: area.name, scores: [], count: 0 });
      }

      const allScores: number[] = [];
      for (const run of scopedRuns) {
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

      try {
        await sendMonthlyReportEmail({
          to: sub.email,
          hotelName,
          monthLabel,
          areas: areaData,
          overallScore,
          totalAudits: allScores.length,
        });
        hotelResult.sent++;
      } catch (err) {
        hotelResult.errors.push(
          `${sub.email}: ${err instanceof Error ? err.message : "Error desconocido"}`
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
