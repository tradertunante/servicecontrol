import "server-only";

import { getResend } from "./resend";

type TrialWelcomeEmailData = {
  to: string;
  name: string;
  hotelName: string;
  email: string;
  password: string;
  loginUrl: string;
  demoUrl: string;
};

export async function sendTrialWelcomeEmail(data: TrialWelcomeEmailData) {
  const resend = getResend();
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "app@servicecontrol.io";
  const displayName = data.name.trim() || data.email.split("@")[0];

  return resend.emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to: data.to,
    subject: `Tu acceso al sandbox de ServiceControl · ${data.hotelName}`,
    html: buildHtml({ ...data, displayName }),
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(data: TrialWelcomeEmailData & { displayName: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tu acceso al sandbox de ServiceControl</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px 56px">

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px;border-radius:12px 12px 0 0">
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">ServiceControl</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;font-weight:500;letter-spacing:0.02em">Sandbox · ${escapeHtml(data.hotelName)}</div>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:40px 32px 36px;border-radius:0 0 12px 12px">

      <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.3;margin-bottom:10px">
        Hola, ${escapeHtml(data.displayName)}
      </div>
      <div style="font-size:14px;color:#64748b;margin-bottom:32px;line-height:1.6">
        Tu sandbox de ServiceControl está listo. Encontrarás el sistema configurado con datos de demostración para
        que puedas explorar auditorías, correctivas, reauditorías y formación tal como funcionarían en
        <strong style="color:#334155">${escapeHtml(data.hotelName)}</strong>.
      </div>

      <!-- Credenciales -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:32px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:16px">
          Tus credenciales de acceso
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">Email</div>
          <div style="font-size:14px;font-weight:600;color:#1e293b;font-family:monospace">${escapeHtml(data.email)}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">Contraseña</div>
          <div style="font-size:18px;font-weight:700;color:#0f172a;font-family:monospace;letter-spacing:0.08em">${escapeHtml(data.password)}</div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:32px">
        <a href="${data.loginUrl}"
           style="display:inline-block;background:#185FA5;color:#ffffff;font-size:14px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:-0.01em">
          Entrar al sandbox &rarr;
        </a>
      </div>

      <!-- Aviso sandbox -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:28px">
        <div style="font-size:13px;color:#92400e;line-height:1.55">
          <strong>Estás en modo sandbox.</strong> Los datos son de demostración. Puedes ejecutar auditorías
          reales para ver cómo funciona el sistema, pero los datos no corresponden a tu hotel.
        </div>
      </div>

      <!-- Qué explorar -->
      <div style="margin-bottom:28px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px">Qué puedes explorar</div>
        ${item("Dashboard ejecutivo", "Score por área, backlog correctivo y focos rojos.")}
        ${item("Ejecutar una auditoría", "Desde móvil, con evidencia y scoring inmediato.")}
        ${item("Acciones correctivas", "Ve cómo se asignan y se hace seguimiento automáticamente.")}
        ${item("Reauditorías y formación", "El loop completo de cierre de desviaciones.")}
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #f1f5f9;padding-top:20px">
        <div style="font-size:12px;color:#94a3b8;line-height:1.7;text-align:center">
          ¿Quieres ver cómo quedaría con tus áreas y estándares reales?<br>
          <a href="${data.demoUrl}" style="color:#185FA5;text-decoration:none;font-weight:600">Solicita una demo guiada</a>
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}

function item(title: string, description: string): string {
  return `
    <div style="display:flex;align-items:flex-start;margin-bottom:12px">
      <div style="min-width:6px;height:6px;background:#185FA5;border-radius:50%;margin-top:6px;margin-right:12px;flex-shrink:0"></div>
      <div>
        <span style="font-size:13px;font-weight:600;color:#1e293b">${title}</span>
        <span style="font-size:13px;color:#64748b"> — ${description}</span>
      </div>
    </div>`;
}