import "server-only";

import { getResend } from "./resend";

type InstantAuditEmailData = {
  to: string;
  hotelName: string;
  areaName: string;
  templateName: string;
  score: number;
  auditorName: string;
  executedAt: string;
  runId: string;
  channel: string;
  failCount: number;
  totalCount: number;
};

export async function sendInstantAuditEmail(data: InstantAuditEmailData) {
  const resend = getResend();

  const scoreColor = data.score >= 80 ? "#16a34a" : data.score >= 60 ? "#d97706" : "#dc2626";
  const channelLabel = data.channel === "quality" ? "Calidad" : "Interna";

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto">
      <div style="background:#111;color:white;padding:20px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:18px;font-weight:900">${data.hotelName}</h1>
        <p style="margin:4px 0 0;opacity:0.7;font-size:13px">Auditoría completada · ${channelLabel}</p>
      </div>

      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 12px 12px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:42px;font-weight:900;color:${scoreColor}">${data.score.toFixed(1)}%</div>
          <div style="font-size:13px;color:#6b7280">Score</div>
        </div>

        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;color:#6b7280">Área</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${data.areaName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Plantilla</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${data.templateName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Auditor</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${data.auditorName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Fecha</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${new Date(data.executedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Fallos</td>
            <td style="padding:6px 0;font-weight:700;text-align:right;color:${data.failCount > 0 ? "#dc2626" : "#16a34a"}">${data.failCount} / ${data.totalCount}</td>
          </tr>
        </table>

        <p style="margin-top:16px;font-size:12px;color:#9ca3af;text-align:center">
          Generado automáticamente por ServiceControl
        </p>
      </div>
    </div>
  `;

  const fromAddress = process.env.RESEND_FROM_EMAIL || "reportes@servicecontrol.app";

  return resend.emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to: data.to,
    subject: `${data.score >= 80 ? "✅" : "⚠️"} ${data.areaName} · ${data.score.toFixed(1)}% · ${data.templateName}`,
    html,
  });
}
