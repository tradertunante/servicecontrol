import "server-only";

import { getResend } from "./resend";

type WeeklyReportEmailData = {
  to: string;
  hotelName: string;
  weekLabel: string;
  areas: {
    name: string;
    score: number;
    auditsCount: number;
  }[];
  overallScore: number;
  totalAudits: number;
};

export async function sendWeeklyReportEmail(data: WeeklyReportEmailData) {
  const resend = getResend();

  const areaRows = data.areas
    .sort((a, b) => a.score - b.score)
    .map(
      (a) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600">${a.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;color:${
            a.score >= 80 ? "#16a34a" : a.score >= 60 ? "#d97706" : "#dc2626"
          }">${a.score.toFixed(1)}%</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280">${a.auditsCount}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#111;color:white;padding:24px 20px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:20px;font-weight:900">${data.hotelName}</h1>
        <p style="margin:4px 0 0;opacity:0.7;font-size:14px">Reporte semanal · ${data.weekLabel}</p>
      </div>

      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 12px 12px">
        <div style="display:flex;gap:20px;margin-bottom:20px">
          <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:900;color:${
              data.overallScore >= 80 ? "#16a34a" : data.overallScore >= 60 ? "#d97706" : "#dc2626"
            }">${data.overallScore.toFixed(1)}%</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Score general</div>
          </div>
          <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:900">${data.totalAudits}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Auditorías</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:700">Área</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:700">Score</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:700">Auditorías</th>
            </tr>
          </thead>
          <tbody>${areaRows}</tbody>
        </table>

        <p style="margin-top:20px;font-size:12px;color:#9ca3af;text-align:center">
          Generado automáticamente por ServiceControl
        </p>
      </div>
    </div>
  `;

  const fromAddress = process.env.RESEND_FROM_EMAIL || "reportes@servicecontrol.app";

  return resend.emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to: data.to,
    subject: `📊 Reporte semanal · ${data.hotelName} · ${data.weekLabel}`,
    html,
  });
}
