import "server-only";

import { getResend } from "./resend";

type SectionScore = {
  name: string;
  score: number;
  failCount: number;
  totalCount: number;
};

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
  teamMemberName: string | null;
  roomNumber: string | null;
  sectionScores: SectionScore[];
};

function sectionColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 75) return "#d97706";
  return "#dc2626";
}

function buildSectionsHtml(sections: SectionScore[]): string {
  if (sections.length === 0) return "";

  const rows = sections
    .map((s) => {
      const color = sectionColor(s.score);
      const failBadge =
        s.failCount > 0
          ? `<span style="background:#fef2f2;color:#dc2626;font-size:11px;padding:2px 6px;border-radius:6px;font-weight:700;margin-left:6px">${s.failCount} FAIL</span>`
          : "";
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px">${s.name}${failBadge}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:900;font-size:14px;color:${color}">${s.score.toFixed(1)}%</td>
        </tr>`;
    })
    .join("");

  return `
    <div style="margin-top:20px">
      <div style="font-weight:900;font-size:14px;margin-bottom:8px;color:#111">Desglose por sección</div>
      <table style="width:100%;border-collapse:collapse">
        ${rows}
      </table>
    </div>`;
}

export async function sendInstantAuditEmail(data: InstantAuditEmailData) {
  const resend = getResend();

  const scoreColor = data.score >= 80 ? "#16a34a" : data.score >= 60 ? "#d97706" : "#dc2626";
  const channelLabel = data.channel === "quality" ? "Calidad" : "Interna";

  // Optional info rows
  const optionalRows: string[] = [];
  if (data.teamMemberName) {
    optionalRows.push(`
      <tr>
        <td style="padding:6px 0;color:#6b7280">Auditado</td>
        <td style="padding:6px 0;font-weight:700;text-align:right">${data.teamMemberName}</td>
      </tr>`);
  }
  if (data.roomNumber) {
    optionalRows.push(`
      <tr>
        <td style="padding:6px 0;color:#6b7280">Habitación</td>
        <td style="padding:6px 0;font-weight:700;text-align:right">${data.roomNumber}</td>
      </tr>`);
  }

  const sectionsHtml = buildSectionsHtml(data.sectionScores);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto">
      <div style="background:#111;color:white;padding:20px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:18px;font-weight:900">${data.hotelName}</h1>
        <p style="margin:4px 0 0;opacity:0.7;font-size:13px">Auditoría completada · ${channelLabel}</p>
      </div>

      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 12px 12px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:48px;font-weight:900;color:${scoreColor}">${data.score.toFixed(1)}%</div>
          <div style="font-size:13px;color:#6b7280">Score general</div>
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
          ${optionalRows.join("")}
          <tr>
            <td style="padding:6px 0;color:#6b7280">Fecha</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${new Date(data.executedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Resultado</td>
            <td style="padding:6px 0;font-weight:700;text-align:right;color:${data.failCount > 0 ? "#dc2626" : "#16a34a"}">${data.failCount} fallos de ${data.totalCount} estándares</td>
          </tr>
        </table>

        ${sectionsHtml}

        <p style="margin-top:20px;font-size:11px;color:#9ca3af;text-align:center">
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
