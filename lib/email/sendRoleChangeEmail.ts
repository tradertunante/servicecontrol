import "server-only";

import { getResend } from "./resend";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { Role } from "@/lib/types";

type RoleChangeEmailData = {
  to: string;
  userName: string | null;
  hotelName: string;
  oldRole: Role;
  newRole: Role;
  loginUrl: string;
};

export async function sendRoleChangeEmail(data: RoleChangeEmailData) {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || "app@servicecontrol.io";
  const displayName = data.userName?.trim() || data.to.split("@")[0];
  const oldLabel = ROLE_LABELS[data.oldRole] ?? data.oldRole;
  const newLabel = ROLE_LABELS[data.newRole] ?? data.newRole;

  return resend.emails.send({
    from: `ServiceControl <${from}>`,
    to: data.to,
    subject: `Tu rol ha cambiado en ${data.hotelName}`,
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 16px 56px">
    <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0">
      <div style="color:#fff;font-size:17px;font-weight:700;letter-spacing:-0.02em">ServiceControl</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;font-weight:500">${escapeHtml(data.hotelName)}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:36px 32px;border-radius:0 0 12px 12px">
      <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:10px">
        Hola, ${escapeHtml(displayName)}
      </div>
      <div style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:24px">
        Un administrador ha actualizado tu rol en <strong style="color:#1e293b">${escapeHtml(data.hotelName)}</strong>.
      </div>
      <div style="display:flex;align-items:center;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:28px">
        <div style="text-align:center;flex:1">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px">Antes</div>
          <div style="font-size:15px;font-weight:700;color:#64748b">${escapeHtml(oldLabel)}</div>
        </div>
        <div style="font-size:20px;color:#cbd5e1;font-weight:300">→</div>
        <div style="text-align:center;flex:1">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#0f766e;margin-bottom:4px">Ahora</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a">${escapeHtml(newLabel)}</div>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${data.loginUrl}"
           style="display:inline-block;background:#0f172a;color:#fff;font-size:14px;font-weight:600;padding:13px 28px;border-radius:8px;text-decoration:none">
          Acceder al panel &rarr;
        </a>
      </div>
      <div style="border-top:1px solid #f1f5f9;padding-top:18px;text-align:center;font-size:12px;color:#94a3b8">
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