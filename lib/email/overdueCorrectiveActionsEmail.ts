import "server-only";

import { getResend } from "./resend";

type OverdueItem = {
  title: string;
  areaName: string | null;
  dueDate: string;
  daysOverdue: number;
  link: string;
};

type OverdueCorrectiveActionsEmailData = {
  to: string;
  recipientName: string | null;
  hotelName: string;
  items: OverdueItem[];
};

export async function sendOverdueCorrectiveActionsEmail(data: OverdueCorrectiveActionsEmailData) {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || "app@servicecontrol.io";
  const displayName = data.recipientName?.trim() || data.to.split("@")[0];
  const count = data.items.length;
  const subject =
    count === 1
      ? `1 acción correctiva vencida en ${data.hotelName}`
      : `${count} acciones correctivas vencidas en ${data.hotelName}`;

  const textLines = [
    subject,
    "",
    `Hola, ${displayName}`,
    "",
    "Estas acciones correctivas llevan pendientes más allá de su fecha límite:",
    "",
    ...data.items.map(
      (it) =>
        `- ${it.title} (${it.areaName ?? "sin área"}) — vencida hace ${it.daysOverdue} día${it.daysOverdue === 1 ? "" : "s"} · ${it.link}`
    ),
    "",
    "Este mensaje fue generado automáticamente. No responder a este correo.",
  ];

  const rows = data.items
    .map(
      (it) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f1f5f9">
            <div style="font-size:14px;font-weight:600;color:#0f172a">${escapeHtml(it.title)}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">${escapeHtml(it.areaName ?? "Sin área")}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap">
            <div style="font-size:12px;font-weight:700;color:#c23a3a">
              ${it.daysOverdue} día${it.daysOverdue === 1 ? "" : "s"} vencida
            </div>
            <a href="${it.link}" style="font-size:12px;color:#2456d6;text-decoration:none">Ver acción &rarr;</a>
          </td>
        </tr>`
    )
    .join("");

  return resend.emails.send({
    from: `ServiceControl <${from}>`,
    to: data.to,
    subject,
    text: textLines.join("\n"),
    headers: { "List-Unsubscribe": "<mailto:app@servicecontrol.io?subject=Unsubscribe>" },
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px 56px">
    <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0">
      <div style="color:#fff;font-size:17px;font-weight:700;letter-spacing:-0.02em">ServiceControl</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;font-weight:500">${escapeHtml(data.hotelName)}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:36px 32px;border-radius:0 0 12px 12px">
      <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:10px">
        Hola, ${escapeHtml(displayName)}
      </div>
      <div style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:20px">
        ${count === 1 ? "Esta acción correctiva lleva pendiente" : `Estas ${count} acciones correctivas llevan pendientes`}
        más allá de su fecha límite:
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${rows}
      </table>
      <div style="border-top:1px solid #f1f5f9;padding-top:18px;margin-top:24px;text-align:center;font-size:12px;color:#94a3b8">
        Este mensaje fue generado automáticamente. No responder a este correo.
      </div>
    </div>
  </div>
</body>
</html>`,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
