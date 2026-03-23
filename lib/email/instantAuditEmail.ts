import "server-only";

import { getResend } from "./resend";
import type { AuditReportData, AuditReportSection, AuditReportItem } from "@/lib/reports/auditReportTypes";

type InstantAuditEmailData = {
  to: string;
  hotelName: string;
  auditorName: string;
  teamMemberName: string | null;
  channel: string;
  report: AuditReportData;
};

function scoreColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 75) return "#d97706";
  return "#dc2626";
}

function sectionScore(s: AuditReportSection): number {
  const denom = Math.max(0, s.total - s.na);
  if (denom === 0) return 100;
  return Math.round(((denom - s.fail) / denom) * 1000) / 10;
}

function buildSectionsHtml(sections: AuditReportSection[]): string {
  if (sections.length === 0) return "";

  const rows = sections
    .map((s) => {
      const score = sectionScore(s);
      const color = scoreColor(score);
      const failBadge =
        s.fail > 0
          ? `<span style="background:#fef2f2;color:#dc2626;font-size:11px;padding:2px 6px;border-radius:6px;font-weight:700;margin-left:6px">${s.fail} FAIL</span>`
          : "";
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px">${s.section_name}${failBadge}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:900;font-size:14px;color:${color}">${score.toFixed(1)}%</td>
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

function buildFailedItemsHtml(sections: AuditReportSection[]): string {
  const failedItems: (AuditReportItem & { sectionName: string })[] = [];
  for (const s of sections) {
    for (const item of s.items) {
      if (item.status === "FAIL") {
        failedItems.push({ ...item, sectionName: s.section_name });
      }
    }
  }
  if (failedItems.length === 0) return "";

  const rows = failedItems
    .map((item) => {
      const commentHtml = item.comment
        ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;font-style:italic">${item.comment}</div>`
        : "";
      const photoHtml = item.photo_url
        ? `<div style="margin-top:3px"><a href="${item.photo_url}" style="font-size:11px;color:#2563eb;text-decoration:underline" target="_blank">📷 Ver foto</a></div>`
        : "";
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:12px">
            <div style="font-weight:600">${item.question_text}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:1px">${item.sectionName}</div>
            ${commentHtml}
            ${photoHtml}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:top">
            <span style="background:#fef2f2;color:#dc2626;font-size:11px;padding:2px 8px;border-radius:6px;font-weight:700">FAIL</span>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="margin-top:20px">
      <div style="font-weight:900;font-size:14px;margin-bottom:8px;color:#dc2626">Estándares con FAIL (${failedItems.length})</div>
      <table style="width:100%;border-collapse:collapse">
        ${rows}
      </table>
    </div>`;
}

export async function sendInstantAuditEmail(data: InstantAuditEmailData) {
  const resend = getResend();

  const { report } = data;
  const score = report.run.score ?? 0;
  const color = scoreColor(score);
  const channelLabel = data.channel === "quality" ? "Calidad" : "Interna";
  const areaName = report.area?.name ?? "Área";
  const templateName = report.template?.name ?? "Auditoría";

  // Optional info rows
  const optionalRows: string[] = [];
  if (data.teamMemberName) {
    optionalRows.push(`
      <tr>
        <td style="padding:6px 0;color:#6b7280">Auditado</td>
        <td style="padding:6px 0;font-weight:700;text-align:right">${data.teamMemberName}</td>
      </tr>`);
  }
  if (report.run.room_number) {
    optionalRows.push(`
      <tr>
        <td style="padding:6px 0;color:#6b7280">Habitación</td>
        <td style="padding:6px 0;font-weight:700;text-align:right">${report.run.room_number}</td>
      </tr>`);
  }

  const sectionsHtml = buildSectionsHtml(report.sections);
  const failedItemsHtml = buildFailedItemsHtml(report.sections);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto">
      <div style="background:#111;color:white;padding:20px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:18px;font-weight:900">${data.hotelName}</h1>
        <p style="margin:4px 0 0;opacity:0.7;font-size:13px">Auditoría completada · ${channelLabel}</p>
      </div>

      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:52px;font-weight:900;color:${color}">${score.toFixed(1)}%</div>
          <div style="font-size:13px;color:#6b7280">Score general</div>
        </div>

        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;color:#6b7280">Área</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${areaName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Plantilla</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${templateName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Auditor</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${data.auditorName}</td>
          </tr>
          ${optionalRows.join("")}
          <tr>
            <td style="padding:6px 0;color:#6b7280">Fecha</td>
            <td style="padding:6px 0;font-weight:700;text-align:right">${report.run.executed_at ? new Date(report.run.executed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Resultado</td>
            <td style="padding:6px 0;font-weight:700;text-align:right;color:${report.summary.fail > 0 ? "#dc2626" : "#16a34a"}">${report.summary.fail} fallos de ${report.summary.total} estándares</td>
          </tr>
        </table>

        ${sectionsHtml}
        ${failedItemsHtml}

        <p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center">
          Generado automáticamente por ServiceControl
        </p>
      </div>
    </div>
  `;

  const fromAddress = process.env.RESEND_FROM_EMAIL || "reportes@servicecontrol.app";

  return resend.emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to: data.to,
    subject: `${score >= 80 ? "✅" : "⚠️"} ${areaName} · ${score.toFixed(1)}% · ${templateName}`,
    html,
  });
}
