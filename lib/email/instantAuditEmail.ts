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

function scoreStatus(score: number): { label: string; bg: string; color: string } {
  if (score >= 90) return { label: "EXCELENTE", bg: "#f0fdf4", color: "#16a34a" };
  if (score >= 75) return { label: "ACEPTABLE", bg: "#fffbeb", color: "#d97706" };
  return { label: "ACCIÓN REQUERIDA", bg: "#fef2f2", color: "#dc2626" };
}

function sectionScore(s: AuditReportSection): number {
  const denom = Math.max(0, s.total - s.na);
  if (denom === 0) return 100;
  return Math.round(((denom - s.fail) / denom) * 1000) / 10;
}

function buildInsightHtml(sections: AuditReportSection[], totalFails: number): string {
  if (totalFails === 0) {
    return `
      <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:14px 16px;border-radius:0 6px 6px 0;margin:24px 0">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#16a34a;text-transform:uppercase;margin-bottom:5px">Resultado destacado</div>
        <div style="font-size:14px;color:#111827;line-height:1.55">Auditoría completada sin ningún fallo. Todos los estándares fueron superados.</div>
      </div>`;
  }

  const worst = sections
    .filter((s) => (s.total - s.na) > 0 && s.fail > 0)
    .map((s) => ({ name: s.section_name, score: sectionScore(s), fail: s.fail }))
    .sort((a, b) => a.score - b.score)[0];

  if (!worst) return "";

  return `
    <div style="background:#fffbeb;border-left:3px solid #d97706;padding:14px 16px;border-radius:0 6px 6px 0;margin:24px 0">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#b45309;text-transform:uppercase;margin-bottom:5px">Principal oportunidad de mejora</div>
      <div style="font-size:14px;color:#111827;line-height:1.55"><strong>${worst.name}</strong> registró el rendimiento más bajo: <strong>${worst.score.toFixed(1)}%</strong> con <strong>${worst.fail} ${worst.fail === 1 ? "fallo" : "fallos"}</strong>. Priorizar revisión de esta sección.</div>
    </div>`;
}

function buildSectionsHtml(sections: AuditReportSection[]): string {
  if (sections.length === 0) return "";

  const rows = sections
    .map((s) => {
      const score = sectionScore(s);
      const color = scoreColor(score);
      const failBadge =
        s.fail > 0
          ? `<span style="background:#fef2f2;color:#dc2626;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;margin-left:6px">${s.fail}</span>`
          : "";
      return `
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151">${s.section_name}${failBadge}</td>
          <td style="padding:9px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;font-size:13px;color:${color}">${score.toFixed(1)}%</td>
        </tr>`;
    })
    .join("");

  return `
    <div style="margin-top:24px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px">Desglose por sección</div>
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
        ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;font-style:italic">${item.comment}</div>`
        : "";
      const photoHtml = item.photo_url
        ? `<div style="margin-top:4px"><a href="${item.photo_url}" style="font-size:12px;color:#2563eb;text-decoration:none;font-weight:500" target="_blank">Ver evidencia →</a></div>`
        : "";
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px">
            <div style="font-weight:600;color:#111827">${item.question_text}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:2px;text-transform:uppercase;letter-spacing:0.05em">${item.sectionName}</div>
            ${commentHtml}
            ${photoHtml}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;padding-left:12px">
            <span style="background:#fef2f2;color:#dc2626;font-size:10px;padding:3px 8px;border-radius:4px;font-weight:700;white-space:nowrap">FALLO</span>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="margin-top:24px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#dc2626;margin-bottom:10px">Estándares fallidos · ${failedItems.length}</div>
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
  const status = scoreStatus(score);
  const channelLabel = data.channel === "quality" ? "Calidad" : "Interna";
  const areaName = report.area?.name ?? "Área";
  const templateName = report.template?.name ?? "Auditoría";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.servicecontrol.io";
  const reportUrl = `${appUrl}/audits/${report.run.id}/view`;

  const dateStr = report.run.executed_at
    ? new Date(report.run.executed_at).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const metaRows: string[] = [
    `<tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px">Área</td>
      <td style="padding:8px 0;font-weight:600;text-align:right;font-size:13px;color:#111827">${areaName}</td>
    </tr>`,
    `<tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px">Plantilla</td>
      <td style="padding:8px 0;font-weight:600;text-align:right;font-size:13px;color:#111827">${templateName}</td>
    </tr>`,
    `<tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px">Auditor</td>
      <td style="padding:8px 0;font-weight:600;text-align:right;font-size:13px;color:#111827">${data.auditorName}</td>
    </tr>`,
  ];

  if (data.teamMemberName) {
    metaRows.push(`
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:13px">Auditado</td>
        <td style="padding:8px 0;font-weight:600;text-align:right;font-size:13px;color:#111827">${data.teamMemberName}</td>
      </tr>`);
  }

  if (report.run.room_number) {
    metaRows.push(`
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:13px">Habitación</td>
        <td style="padding:8px 0;font-weight:600;text-align:right;font-size:13px;color:#111827">${report.run.room_number}</td>
      </tr>`);
  }

  metaRows.push(
    `<tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px">Resultado</td>
      <td style="padding:8px 0;font-weight:600;text-align:right;font-size:13px;color:${report.summary.fail > 0 ? "#dc2626" : "#16a34a"}">${report.summary.fail} ${report.summary.fail === 1 ? "fallo" : "fallos"} de ${report.summary.total} estándares</td>
    </tr>`,
    `<tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px">Fecha</td>
      <td style="padding:8px 0;font-weight:600;text-align:right;font-size:13px;color:#111827">${dateStr}</td>
    </tr>`,
  );

  const insightHtml = buildInsightHtml(report.sections, report.summary.fail);
  const sectionsHtml = buildSectionsHtml(report.sections);
  const failedItemsHtml = buildFailedItemsHtml(report.sections);

  let subject: string;
  if (score >= 90) {
    subject = `✅ ${areaName} — ${score.toFixed(1)}% · Todo en orden · ${data.hotelName}`;
  } else if (score >= 75) {
    subject = `⚠️ ${areaName} — ${score.toFixed(1)}% · ${report.summary.fail} ${report.summary.fail === 1 ? "estándar pendiente" : "estándares pendientes"} · ${data.hotelName}`;
  } else {
    subject = `🔴 Atención: ${areaName} al ${score.toFixed(1)}% · ${report.summary.fail} fallos detectados · ${data.hotelName}`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px 48px">

    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td>
            <div style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.01em">${data.hotelName}</div>
            <div style="color:#64748b;font-size:12px;margin-top:3px;font-weight:500">Auditoría ${channelLabel} · ServiceControl</div>
          </td>
          <td style="text-align:right;vertical-align:top">
            <span style="background:#1e293b;color:#94a3b8;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;white-space:nowrap">${channelLabel.toUpperCase()}</span>
          </td>
        </tr>
      </table>
    </div>

    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:32px 28px 28px;border-radius:0 0 12px 12px">

      <div style="text-align:center;padding-bottom:24px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px">${templateName} &nbsp;·&nbsp; ${areaName}</div>
        <div style="font-size:80px;font-weight:800;line-height:0.9;color:${color};letter-spacing:-0.03em">${score.toFixed(1)}<span style="font-size:40px">%</span></div>
        <div style="margin-top:14px">
          <span style="display:inline-block;background:${status.bg};color:${status.color};font-size:11px;font-weight:700;letter-spacing:0.08em;padding:5px 14px;border-radius:20px;text-transform:uppercase">${status.label}</span>
        </div>
      </div>

      <div style="border-top:1px solid #f1f5f9;margin-bottom:20px"></div>

      <table style="width:100%;border-collapse:collapse">
        ${metaRows.join("")}
      </table>

      ${insightHtml}
      ${sectionsHtml}
      ${failedItemsHtml}

      <div style="margin-top:32px;text-align:center">
        <a href="${reportUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:13px 28px;border-radius:8px;text-decoration:none;letter-spacing:-0.01em">Ver informe completo →</a>
      </div>

      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;text-align:center">
        <div style="font-size:11px;color:#cbd5e1;line-height:1.7">ServiceControl · Gestión de calidad operativa para hoteles<br>Este mensaje fue generado automáticamente. No responder a este correo.</div>
      </div>

    </div>
  </div>
</body>
</html>`;

  const fromAddress = process.env.RESEND_FROM_EMAIL || "no-reply@servicecontrol.io";

  return resend.emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to: data.to,
    subject,
    html,
  });
}
