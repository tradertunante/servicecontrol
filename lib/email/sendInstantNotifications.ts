import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInstantAuditEmail } from "./instantAuditEmail";

/**
 * Send instant email notifications to subscribers after an audit is submitted.
 * Runs fire-and-forget (does not block the submit response).
 */
export async function sendInstantNotifications(runId: string) {
  try {
    const admin = supabaseAdmin();

    // Get the submitted run with related data
    const { data: run } = await admin
      .from("audit_runs")
      .select("id,hotel_id,area_id,audit_template_id,score,executed_at,executed_by,audit_channel,room_number,team_member_id")
      .eq("id", runId)
      .single();

    if (!run?.hotel_id) return;

    // Get area, template, auditor, team member names in parallel
    const [{ data: area }, { data: template }, { data: auditor }, teamMember, hotel] = await Promise.all([
      admin.from("areas").select("name").eq("id", run.area_id).single(),
      admin.from("audit_templates").select("name").eq("id", run.audit_template_id).single(),
      admin.from("profiles").select("full_name").eq("id", run.executed_by).single(),
      run.team_member_id
        ? admin.from("team_members").select("full_name").eq("id", run.team_member_id).single().then((r) => r.data)
        : Promise.resolve(null),
      admin.from("hotels").select("name").eq("id", run.hotel_id).single().then((r) => r.data),
    ]);

    // Get answers with section info via questions join
    const { data: answers } = await admin
      .from("audit_answers")
      .select("result, question_id")
      .eq("audit_run_id", runId);

    // Get sections and questions for this template to compute section scores
    const { data: sections } = await admin
      .from("audit_sections")
      .select("id, name, sort_order")
      .eq("audit_template_id", run.audit_template_id)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    const { data: questions } = await admin
      .from("audit_questions")
      .select("id, audit_section_id")
      .eq("active", true)
      .in("audit_section_id", (sections ?? []).map((s) => s.id));

    // Build section scores
    const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.result]));
    const sectionScores: { name: string; score: number; failCount: number; totalCount: number }[] = [];

    for (const section of sections ?? []) {
      const sectionQuestions = (questions ?? []).filter((q) => q.audit_section_id === section.id);
      let fails = 0;
      let naCount = 0;
      for (const q of sectionQuestions) {
        const result = (answerMap.get(q.id) ?? "").toString().toUpperCase();
        if (result === "FAIL") fails++;
        if (result === "NA") naCount++;
      }
      const denominator = Math.max(0, sectionQuestions.length - naCount);
      const passCount = Math.max(0, denominator - fails);
      const score = denominator > 0 ? Math.round((passCount / denominator) * 1000) / 10 : 100;
      sectionScores.push({
        name: section.name,
        score,
        failCount: fails,
        totalCount: sectionQuestions.length,
      });
    }

    const totalCount = answers?.length ?? 0;
    const failCount = (answers ?? []).filter((a) => (a.result ?? "").toString().toUpperCase() === "FAIL").length;

    // Find instant subscribers for this hotel
    const { data: subs } = await admin
      .from("report_subscriptions")
      .select("email,scope,area_ids,channel")
      .eq("hotel_id", run.hotel_id)
      .eq("frequency", "instant")
      .eq("active", true);

    if (!subs || subs.length === 0) return;

    const auditChannel = run.audit_channel ?? "internal";

    for (const sub of subs) {
      // Filter by channel
      if (sub.channel !== "all" && sub.channel !== auditChannel) continue;

      // Filter by area scope
      if (sub.scope === "specific_areas" && Array.isArray(sub.area_ids)) {
        if (!sub.area_ids.includes(run.area_id)) continue;
      }

      try {
        await sendInstantAuditEmail({
          to: sub.email,
          hotelName: hotel?.name ?? "Hotel",
          areaName: area?.name ?? "Área",
          templateName: template?.name ?? "Auditoría",
          score: run.score ?? 0,
          auditorName: auditor?.full_name ?? "—",
          executedAt: run.executed_at ?? new Date().toISOString(),
          runId: run.id,
          channel: auditChannel,
          failCount,
          totalCount,
          teamMemberName: teamMember?.full_name ?? null,
          roomNumber: run.room_number ?? null,
          sectionScores,
        });
      } catch (emailErr) {
        console.error("[instant-email] Failed to send to", sub.email, emailErr);
      }
    }
  } catch (err) {
    console.error("[instant-email] Error:", err);
  }
}
