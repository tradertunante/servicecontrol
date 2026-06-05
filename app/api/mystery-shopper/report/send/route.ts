import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getResend } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, {
      roles: ["mystery_shopper", "admin", "superadmin"],
    });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    // mystery_shopper sends their own report; admin can send for any shopper
    let shopperId = caller.profile.id;
    let shopperEmail = caller.profile.id; // fallback
    if (caller.profile.role !== "mystery_shopper") {
      const body = await request.json().catch(() => null);
      const qid = String(body?.shopper_id ?? "").trim();
      if (!qid) return jsonError("shopper_id es obligatorio.", 400);
      shopperId = qid;
    }

    const admin = supabaseAdmin();

    // Load shopper profile
    const { data: shopper, error: shopperErr } = await admin
      .from("profiles")
      .select("id, full_name, email, access_expires_at")
      .eq("id", shopperId)
      .eq("hotel_id", hotelResult.hotelId)
      .eq("role", "mystery_shopper")
      .maybeSingle();

    if (shopperErr) return jsonDbError(shopperErr);
    if (!shopper) return jsonError("Mystery shopper no encontrado.", 404);

    shopperEmail = shopper.email ?? "";

    // Load all submitted audit runs for this shopper
    const { data: runs, error: runsErr } = await admin
      .from("audit_runs")
      .select("id, area_id, audit_template_id, score, executed_at, status, room_number, areas(name), audit_templates(name)")
      .eq("hotel_id", hotelResult.hotelId)
      .eq("executed_by", shopperId)
      .eq("status", "submitted")
      .order("executed_at", { ascending: true });

    if (runsErr) return jsonDbError(runsErr);

    const { data: hotel } = await admin
      .from("hotels")
      .select("name")
      .eq("id", hotelResult.hotelId)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.servicecontrol.io";
    const runList = (runs ?? []) as Array<{
      id: string;
      area_id: string | null;
      audit_template_id: string | null;
      score: number | null;
      executed_at: string | null;
      room_number: string | null;
      areas: { name: string } | null;
      audit_templates: { name: string } | null;
    }>;

    const totalRuns = runList.length;
    const avgScore =
      totalRuns > 0
        ? Math.round(runList.reduce((s, r) => s + (r.score ?? 0), 0) / totalRuns)
        : null;

    const hotelName = hotel?.name ?? "Hotel";
    const shopperName = shopper.full_name ?? shopperEmail;

    // Build run rows HTML
    const runRows = runList
      .map((r) => {
        const area = (r.areas as any)?.name ?? "-";
        const template = (r.audit_templates as any)?.name ?? "-";
        const score = r.score !== null ? `${r.score}%` : "-";
        const date = r.executed_at
          ? new Date(r.executed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
          : "-";
        const link = `${appUrl}/audits/${r.id}/report`;
        return `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${escapeHtml(area)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${escapeHtml(template)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center;color:#0f172a;font-weight:600">${score}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;white-space:nowrap">${date}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px">
            <a href="${link}" style="color:#0f172a;font-weight:600;text-decoration:underline">Ver →</a>
          </td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Reporte Mystery Shopper</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:40px 16px 56px">

  <div style="background:#0f172a;padding:28px 32px;border-radius:12px 12px 0 0">
    <div style="color:#fff;font-size:18px;font-weight:700">ServiceControl</div>
    <div style="color:#64748b;font-size:12px;margin-top:4px">Reporte Mystery Shopper · ${escapeHtml(hotelName)}</div>
  </div>

  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:40px 32px 36px;border-radius:0 0 12px 12px">
    <div style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:8px">Reporte de estancia</div>
    <div style="font-size:14px;color:#64748b;margin-bottom:28px">
      <strong style="color:#334155">${escapeHtml(shopperName)}</strong> · ${escapeHtml(hotelName)}
    </div>

    <!-- Summary -->
    <div style="display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:800;color:#0f172a">${totalRuns}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Auditorías realizadas</div>
      </div>
      ${avgScore !== null ? `<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:800;color:#0f172a">${avgScore}%</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Puntuación media</div>
      </div>` : ""}
    </div>

    <!-- Runs table -->
    ${totalRuns > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8">Área</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8">Auditoría</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8">Score</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8">Fecha</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8"></th>
        </tr>
      </thead>
      <tbody>${runRows}</tbody>
    </table>` : `<div style="color:#64748b;font-size:14px;margin-bottom:28px">No hay auditorías enviadas aún.</div>`}

    <div style="border-top:1px solid #f1f5f9;padding-top:20px;text-align:center;font-size:12px;color:#94a3b8">
      Generado automáticamente por ServiceControl
    </div>
  </div>
</div>
</body>
</html>`;

    // Send to quality subscribers + shopper's own email
    const { data: subs } = await admin
      .from("report_subscriptions")
      .select("email")
      .eq("hotel_id", hotelResult.hotelId)
      .in("channel", ["all", "quality"])
      .eq("active", true);

    const recipients = Array.from(
      new Set([
        ...(subs ?? []).map((s: any) => s.email as string).filter(Boolean),
        ...(shopperEmail ? [shopperEmail] : []),
      ])
    );

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent_to: [] });
    }

    const resend = getResend();
    const fromAddress = process.env.RESEND_FROM_EMAIL || "app@servicecontrol.io";

    await resend.emails.send({
      from: `ServiceControl <${fromAddress}>`,
      to: recipients,
      subject: `Reporte Mystery Shopper · ${shopperName} · ${hotelName}`,
      html,
    });

    return NextResponse.json({ ok: true, sent_to: recipients });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}