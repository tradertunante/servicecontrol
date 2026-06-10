import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWeeklyReportEmail } from "@/lib/email/weeklyReportEmail";
import { generateReportNarrative } from "@/lib/reports/generateNarrative";
import type { AreaReportData } from "@/lib/reports/generateNarrative";
import { jsonError, jsonDbError } from "@/lib/api/response";

// Vercel cron invokes with GET + Authorization: Bearer ${CRON_SECRET};
// x-cron-secret is kept for manual server-to-server triggers.
function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

async function resolveSubscribedHotelIds(): Promise<string[] | NextResponse> {
  const admin = supabaseAdmin();
  const { data: subs, error } = await admin
    .from("report_subscriptions")
    .select("hotel_id")
    .eq("frequency", "weekly")
    .eq("active", true);

  if (error) return jsonDbError(error);
  return Array.from(new Set((subs ?? []).map((s) => s.hotel_id)));
}

/**
 * GET /api/reports/send-weekly
 * Entry point for Vercel cron (Monday 8am UTC).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return jsonError("No autorizado.", 401);
  const hotelIds = await resolveSubscribedHotelIds();
  if (hotelIds instanceof NextResponse) return hotelIds;
  return sendWeeklyReports(hotelIds);
}

/**
 * POST /api/reports/send-weekly
 * Manual trigger: admin with { hotel_id }, or server-to-server with x-cron-secret.
 */
export async function POST(request: NextRequest) {
  let hotelIds: string[] = [];

  if (isAuthorizedCronRequest(request)) {
    const resolved = await resolveSubscribedHotelIds();
    if (resolved instanceof NextResponse) return resolved;
    hotelIds = resolved;
  } else {
    const caller = await authorizeRouteRequest(request, { roles: ["superadmin", "admin"] });
    if (!caller) return jsonError("No autorizado.", 401);
    const body = await request.json().catch(() => null);
    const hotelId = typeof body?.hotel_id === "string" ? body.hotel_id.trim() : "";
    if (!hotelId) return jsonError("hotel_id es obligatorio.", 400);
    hotelIds = [hotelId];
  }

  return sendWeeklyReports(hotelIds);
}

async function sendWeeklyReports(hotelIds: string[]) {
  const admin = supabaseAdmin();
  const results: { hotel: string; sent: number; errors: string[] }[] = [];

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const weekLabel = `${weekStart.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} - ${now.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`;

  for (const hotelId of hotelIds) {
    const hotelResult: { hotel: string; sent: number; errors: string[] } = {
      hotel: hotelId,
      sent: 0,
      errors: [],
    };

    const { data: hotel } = await admin.from("hotels").select("name").eq("id", hotelId).single();
    const hotelName = hotel?.name || "Hotel";

    const { data: subs } = await admin
      .from("report_subscriptions")
      .select("email,scope,area_ids,channel")
      .eq("hotel_id", hotelId)
      .eq("frequency", "weekly")
      .eq("active", true);

    if (!subs || subs.length === 0) {
      hotelResult.errors.push("Sin suscriptores activos.");
      results.push(hotelResult);
      continue;
    }

    const { data: areas } = await admin.from("areas").select("id,name").eq("hotel_id", hotelId);

    // Current week runs
    const { data: runs } = await admin
      .from("audit_runs")
      .select("id,area_id,score,audit_channel")
      .eq("hotel_id", hotelId)
      .eq("status", "submitted")
      .is("archived_at", null)
      .gte("executed_at", weekStart.toISOString())
      .lte("executed_at", now.toISOString());

    // Previous week runs (for trend)
    const { data: prevRuns } = await admin
      .from("audit_runs")
      .select("area_id,score,audit_channel")
      .eq("hotel_id", hotelId)
      .eq("status", "submitted")
      .is("archived_at", null)
      .gte("executed_at", prevWeekStart.toISOString())
      .lt("executed_at", weekStart.toISOString());

    // Top failing questions this week
    const runIds = (runs ?? []).map(r => r.id);
    const { data: failingAnswers } = runIds.length
      ? await admin
          .from("audit_answers")
          .select("question_text, audit_run_id")
          .in("audit_run_id", runIds)
          .or("result.eq.FAIL,answer.eq.FAIL")
      : { data: [] };

    // Count failures per question text
    const failCountByQ = new Map<string, number>();
    for (const ans of failingAnswers ?? []) {
      const q = String(ans.question_text ?? "").trim();
      if (!q) continue;
      failCountByQ.set(q, (failCountByQ.get(q) ?? 0) + 1);
    }
    // Open corrective actions
    const { data: correctiveActions } = await admin
      .from("audit_corrective_actions")
      .select("id,opened_at,status")
      .eq("hotel_id", hotelId)
      .in("status", ["open", "pending"]);

    const overdueCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const openCAs = (correctiveActions ?? []).filter(ca => ca.status !== "closed");
    const overdueCAs = openCAs.filter(ca => ca.opened_at < overdueCutoff);

    // Build area stats
    const areaMap = new Map<string, { name: string; scores: number[]; count: number }>();
    for (const area of areas ?? []) areaMap.set(area.id, { name: area.name, scores: [], count: 0 });

    const prevAreaScores = new Map<string, number[]>();
    for (const run of prevRuns ?? []) {
      if (run.score == null) continue;
      if (!prevAreaScores.has(run.area_id)) prevAreaScores.set(run.area_id, []);
      prevAreaScores.get(run.area_id)!.push(run.score);
    }

    // Failures by area (from run ids mapped to area_id)
    const runAreaMap = new Map((runs ?? []).map(r => [r.id, r.area_id]));
    const failsByArea = new Map<string, string[]>();
    for (const ans of failingAnswers ?? []) {
      const areaId = runAreaMap.get(String(ans.audit_run_id));
      if (!areaId) continue;
      const q = String(ans.question_text ?? "").trim().slice(0, 80);
      if (!q) continue;
      const bucket = failsByArea.get(areaId) ?? [];
      bucket.push(q);
      failsByArea.set(areaId, bucket);
    }

    const allScores: number[] = [];
    for (const run of runs ?? []) {
      if (run.score == null) continue;
      allScores.push(run.score);
      const entry = areaMap.get(run.area_id);
      if (entry) { entry.scores.push(run.score); entry.count++; }
    }

    const overallScore = allScores.length
      ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0;

    const prevAllScores = (prevRuns ?? []).map(r => r.score).filter((s): s is number => s != null);
    const prevOverallScore = prevAllScores.length
      ? prevAllScores.reduce((s, v) => s + v, 0) / prevAllScores.length : null;

    const areaDataForNarrative: AreaReportData[] = Array.from(areaMap.entries())
      .filter(([, a]) => a.count > 0)
      .map(([id, a]) => {
        const prevScores = prevAreaScores.get(id);
        const areaFails = failsByArea.get(id) ?? [];
        const topAreaFails = Array.from(new Map(areaFails.map(f => [f, (areaFails.filter(x => x === f).length)])).entries())
          .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([q]) => q);
        return {
          name: a.name,
          score: a.scores.reduce((s, v) => s + v, 0) / a.scores.length,
          prevScore: prevScores?.length ? prevScores.reduce((s, v) => s + v, 0) / prevScores.length : null,
          auditsCount: a.count,
          topFailures: topAreaFails,
          openCorrectiveActions: openCAs.length,
          overdueCorrectiveActions: overdueCAs.length,
        };
      });

    // Generate AI narrative (once per hotel, shared across subscribers)
    let narrative: { hotel: string; areas: Record<string, string> } | null = null;
    if (areaDataForNarrative.length > 0) {
      try {
        narrative = await generateReportNarrative({
          hotelName,
          periodLabel: weekLabel,
          periodType: "weekly",
          overallScore,
          prevOverallScore,
          totalAudits: allScores.length,
          areas: areaDataForNarrative,
        }, hotelId);

        // Cache narrative in DB
        await admin.from("report_narratives").insert({
          hotel_id: hotelId,
          period_type: "weekly",
          period_label: weekLabel,
          period_start: weekStart.toISOString(),
          period_end: now.toISOString(),
          narrative_hotel: narrative.hotel,
          narrative_areas: narrative.areas,
          overall_score: overallScore,
          prev_overall_score: prevOverallScore,
          total_audits: allScores.length,
        });
      } catch {
        // Non-fatal: send email without narrative if AI fails
        narrative = null;
      }
    }

    for (const sub of subs) {
      const filteredRuns = (runs ?? []).filter(run => {
        const ch = run.audit_channel ?? "internal";
        if (sub.channel !== "all" && sub.channel !== ch) return false;
        return true;
      });

      const scopedRuns = filteredRuns.filter(run => {
        if (sub.scope === "specific_areas" && Array.isArray(sub.area_ids)) {
          return sub.area_ids.includes(run.area_id);
        }
        return true;
      });

      if (scopedRuns.length === 0) continue;

      const scopedAreaMap = new Map<string, { name: string; scores: number[]; count: number }>();
      for (const area of areas ?? []) scopedAreaMap.set(area.id, { name: area.name, scores: [], count: 0 });

      const scopedAllScores: number[] = [];
      for (const run of scopedRuns) {
        if (run.score == null) continue;
        scopedAllScores.push(run.score);
        const entry = scopedAreaMap.get(run.area_id);
        if (entry) { entry.scores.push(run.score); entry.count++; }
      }

      const scopedAreaData = Array.from(scopedAreaMap.values())
        .filter(a => a.count > 0)
        .map(a => ({
          name: a.name,
          score: a.scores.reduce((s, v) => s + v, 0) / a.scores.length,
          auditsCount: a.count,
        }));

      const scopedOverallScore = scopedAllScores.length
        ? scopedAllScores.reduce((s, v) => s + v, 0) / scopedAllScores.length : 0;

      try {
        await sendWeeklyReportEmail({
          to: sub.email,
          hotelName,
          weekLabel,
          areas: scopedAreaData,
          overallScore: scopedOverallScore,
          totalAudits: scopedAllScores.length,
          narrativeHotel: narrative?.hotel ?? null,
        });
        hotelResult.sent++;
      } catch (err) {
        hotelResult.errors.push(`${sub.email}: ${err instanceof Error ? err.message : "Error desconocido"}`);
      }
    }

    results.push(hotelResult);
  }

  return NextResponse.json({ ok: true, totalSent: results.reduce((s, r) => s + r.sent, 0), results });
}