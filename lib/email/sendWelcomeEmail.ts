import "server-only";

import { getResend } from "./resend";

type WelcomeEmailData = {
  to: string;
  userName: string | null;
  hotelName: string;
  loginUrl: string;
};

export async function sendWelcomeEmail(data: WelcomeEmailData) {
  const resend = getResend();
  const fromAddress = process.env.RESEND_FROM_EMAIL || "no-reply@servicecontrol.io";
  const displayName = data.userName?.trim() || data.to.split("@")[0];

  const html = buildWelcomeHtml({ ...data, displayName });

  return resend.emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to: data.to,
    subject: `Bienvenido a ServiceControl · ${data.hotelName}`,
    html,
  });
}

function buildWelcomeHtml(data: WelcomeEmailData & { displayName: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bienvenido a ServiceControl</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <div style="max-width:580px;margin:0 auto;padding:40px 16px 56px">

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px;border-radius:12px 12px 0 0">
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">ServiceControl</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;font-weight:500;letter-spacing:0.02em">Gestión de calidad operativa · ${data.hotelName}</div>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:40px 32px 36px;border-radius:0 0 12px 12px">

      <!-- Greeting -->
      <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.3;margin-bottom:12px">
        Bienvenido, ${escapeHtml(data.displayName)}
      </div>
      <div style="font-size:14px;color:#64748b;margin-bottom:28px;line-height:1.6">
        Tu cuenta en ServiceControl para <strong style="color:#334155">${escapeHtml(data.hotelName)}</strong> ha sido creada.<br>
        Ya puedes acceder a la plataforma de gestión de calidad operativa.
      </div>

      <!-- Divider -->
      <div style="border-top:1px solid #f1f5f9;margin-bottom:28px"></div>

      <!-- Value props -->
      <div style="margin-bottom:32px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:16px">Qué encontrarás</div>

        ${valueRow("Auditorías operativas", "Realiza y gestiona auditorías de calidad en todas las áreas del hotel.")}
        ${valueRow("Seguimiento en tiempo real", "Consulta resultados, tendencias y acciones correctivas al instante.")}
        ${valueRow("Mejora continua", "Identifica oportunidades y eleva los estándares operativos de tu equipo.")}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:36px">
        <a href="${data.loginUrl}"
           style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:-0.01em">
          Acceder al panel &rarr;
        </a>
        <div style="margin-top:12px;font-size:12px;color:#94a3b8">
          O copia este enlace: <span style="color:#475569">${data.loginUrl}</span>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #f1f5f9;padding-top:20px;text-align:center">
        <div style="font-size:12px;color:#94a3b8;line-height:1.7">
          <strong style="color:#64748b">${escapeHtml(data.hotelName)}</strong> · ServiceControl<br>
          Este mensaje fue generado automáticamente. No responder a este correo.
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}

function valueRow(title: string, description: string): string {
  return `
    <div style="display:flex;align-items:flex-start;margin-bottom:14px">
      <div style="min-width:6px;height:6px;background:#0f172a;border-radius:50%;margin-top:6px;margin-right:12px"></div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:2px">${title}</div>
        <div style="font-size:13px;color:#64748b;line-height:1.5">${description}</div>
      </div>
    </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
