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
      .select("id,hotel_id,area_id,audit_template_id,score,executed_at,executed_by,audit_channel")
      .eq("id", runId)
      .single();

    if (!run?.hotel_id) return;

    // Get area, template, auditor names
    const [{ data: area }, { data: template }, { data: auditor }] = await Promise.all([
      admin.from("areas").select("name").eq("id", run.area_id).single(),
      admin.from("audit_templates").select("name").eq("id", run.audit_template_id).single(),
      admin.from("profiles").select("full_name").eq("id", run.executed_by).single(),
    ]);

    // Get answer counts
    const { data: answers } = await admin
      .from("audit_answers")
      .select("result")
      .eq("audit_run_id", runId);

    const totalCount = answers?.length ?? 0;
    const failCount = (answers ?? []).filter((a) => a.result === "FAIL").length;

    // Get hotel name
    const { data: hotel } = await admin
      .from("hotels")
      .select("name")
      .eq("id", run.hotel_id)
      .single();

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
      // 'all_areas' and 'my_areas' pass through (my_areas would need user context, treat as all for instant)

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
        });
      } catch (emailErr) {
        console.error("[instant-email] Failed to send to", sub.email, emailErr);
      }
    }
  } catch (err) {
    console.error("[instant-email] Error:", err);
  }
}
