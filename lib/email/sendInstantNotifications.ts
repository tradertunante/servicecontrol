import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildAuditReportData } from "@/lib/reports/auditReport";
import { sendInstantAuditEmail } from "./instantAuditEmail";
import { shouldSendNotification } from "@/lib/notifications/notificationSettings";

/**
 * Send instant email notifications to subscribers after an audit is submitted.
 * Runs fire-and-forget (does not block the submit response).
 */
export async function sendInstantNotifications(runId: string) {
  try {
    const admin = supabaseAdmin();

    // Get the submitted run
    const { data: run } = await admin
      .from("audit_runs")
      .select("id,hotel_id,area_id,audit_channel,executed_by,team_member_id")
      .eq("id", runId)
      .single();

    if (!run?.hotel_id) return;

    // Gate on hotel notification settings (only quality audits have a toggle for now)
    if (run.audit_channel === "quality") {
      const enabled = await shouldSendNotification(run.hotel_id, "quality_audit_submitted_email");
      if (!enabled) return;
    }

    // Find instant subscribers for this hotel
    const { data: subs } = await admin
      .from("report_subscriptions")
      .select("email,scope,area_ids,channel")
      .eq("hotel_id", run.hotel_id)
      .eq("frequency", "instant")
      .eq("active", true);

    if (!subs || subs.length === 0) return;

    const auditChannel = run.audit_channel ?? "internal";

    // Filter subscribers
    const recipients = subs.filter((sub) => {
      if (sub.channel !== "all" && sub.channel !== auditChannel) return false;
      if (sub.scope === "specific_areas" && Array.isArray(sub.area_ids)) {
        if (!sub.area_ids.includes(run.area_id)) return false;
      }
      return true;
    });

    if (recipients.length === 0) return;

    // Build full report data (reuse existing report builder)
    const report = await buildAuditReportData(runId, run.hotel_id);

    // Get extra info: hotel name, auditor name, team member name
    const [{ data: hotel }, { data: auditor }, teamMember] = await Promise.all([
      admin.from("hotels").select("name").eq("id", run.hotel_id).single(),
      run.executed_by
        ? admin.from("profiles").select("full_name").eq("id", run.executed_by).single()
        : Promise.resolve({ data: null }),
      run.team_member_id
        ? admin.from("team_members").select("full_name").eq("id", run.team_member_id).single().then((r) => r.data)
        : Promise.resolve(null),
    ]);

    for (const sub of recipients) {
      try {
        await sendInstantAuditEmail({
          to: sub.email,
          hotelName: hotel?.name ?? "Hotel",
          auditorName: auditor?.full_name ?? "—",
          teamMemberName: teamMember?.full_name ?? null,
          channel: auditChannel,
          report,
        });
      } catch (emailErr) {
        console.error("[instant-email] Failed to send to", sub.email, emailErr);
      }
    }
  } catch (err) {
    console.error("[instant-email] Error:", err);
  }
}
