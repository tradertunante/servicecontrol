import "server-only";

import { getResend } from "./resend";

type MonthlyReportEmailData = {
  to: string;
  hotelName: string;
  monthLabel: string;
  areas: {
    name: string;
    score: number;
    auditsCount: number;
    prevScore?: number | null;
  }[];
  overallScore: number;
  prevOverallScore?: number | null;
  totalAudits: number;
};

export async function sendMonthlyReportEmail(data: MonthlyReportEmailData) {
  const resend = getResend();

  const trendIcon = (current: number, prev?: number | null) => {
    if (prev == null) return "";
    const diff = current - prev;
    if (Math.abs(diff) < 0.5) return `<span style="color:#6b7280">→</span>`;
    return diff > 0
      ? `<span style="color:#16a34a">▲ ${diff.toFixed(1)}</span>`
      : `<span style="color:#dc2626">▼ ${Math.abs(diff).toFixed(1)}</span>`;
  };

  const areaRows = data.areas
    .sort((a, b) => a.score - b.score)
    .map(
      (a) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600">${a.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;color:${
            a.score >= 80 ? "#16a34a" : a.score >= 60 ? "#d97706" : "#dc2626"
          }">${a.score.toFixed(1)}%</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px">${trendIcon(a.score, a.prevScore)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280">${a.auditsCount}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#111;color:white;padding:24px 20px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:20px;font-weight:900">${data.hotelName}</h1>
        <p style="margin:4px 0 0;opacity:0.7;font-size:14px">Reporte mensual · ${data.monthLabel}</p>
      </div>

      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 12px 12px">
        <div style="display:flex;gap:20px;margin-bottom:20px">
          <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:900;color:${
              data.overallScore >= 80 ? "#16a34a" : data.overallScore >= 60 ? "#d97706" : "#dc2626"
            }">${data.overallScore.toFixed(1)}%</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">Score general ${trendIcon(data.overallScore, data.prevOverallScore)}</div>
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
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:700">Tendencia</th>
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
    subject: `📊 Reporte mensual · ${data.hotelName} · ${data.monthLabel}`,
    html,
  });
}
