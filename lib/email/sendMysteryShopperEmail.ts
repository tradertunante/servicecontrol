import "server-only";

import { getResend } from "./resend";

type MysteryShopperEmailData = {
  to: string;
  userName: string | null;
  hotelName: string;
  password: string;
  daysActive: number;
  loginUrl: string;
};

export async function sendMysteryShopperEmail(data: MysteryShopperEmailData) {
  const resend = getResend();
  const fromAddress = process.env.RESEND_FROM_EMAIL || "app@servicecontrol.io";
  const displayName = data.userName?.trim() || data.to.split("@")[0];

  return resend.emails.send({
    from: `ServiceControl <${fromAddress}>`,
    to: data.to,
    subject: `Acceso Mystery Shopper · ${data.hotelName}`,
    html: buildHtml({ ...data, displayName }),
  });
}

function buildHtml(data: MysteryShopperEmailData & { displayName: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Acceso Mystery Shopper</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <div style="max-width:580px;margin:0 auto;padding:40px 16px 56px">

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px;border-radius:12px 12px 0 0">
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">ServiceControl</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;font-weight:500;letter-spacing:0.02em">Auditoría Mystery Shopper · ${escapeHtml(data.hotelName)}</div>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:40px 32px 36px;border-radius:0 0 12px 12px">

      <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.3;margin-bottom:12px">
        Hola, ${escapeHtml(data.displayName)}
      </div>
      <div style="font-size:14px;color:#64748b;margin-bottom:28px;line-height:1.6">
        Has sido asignado/a como <strong style="color:#334155">Mystery Shopper</strong> en <strong style="color:#334155">${escapeHtml(data.hotelName)}</strong>.<br>
        Tu acceso estará activo durante <strong style="color:#334155">${data.daysActive} días</strong>.
      </div>

      <!-- Credentials -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:28px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px">Tus credenciales de acceso</div>
        ${credRow("Email", escapeHtml(data.to))}
        ${credRow("Contraseña", escapeHtml(data.password))}
        <div style="margin-top:12px;font-size:12px;color:#94a3b8;line-height:1.5">
          Guarda estos datos. Por seguridad, te recomendamos cambiar la contraseña tras el primer acceso.
        </div>
      </div>

      <!-- How it works -->
      <div style="margin-bottom:32px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:16px">Cómo funciona</div>
        ${stepRow("1", "Accede con tu email y contraseña usando el botón de abajo.")}
        ${stepRow("2", "Verás un panel con todas las áreas del hotel disponibles para auditar.")}
        ${stepRow("3", "Para cada área, selecciona la auditoría que quieres realizar y completa el formulario respondiendo cada punto.")}
        ${stepRow("4", "Puedes pausar y continuar cuando quieras — tus respuestas se guardan automáticamente.")}
        ${stepRow("5", "Cuando hayas terminado todas las auditorías, pulsa <strong>Enviar Reporte</strong> para que el equipo de calidad reciba tus resultados.")}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:36px">
        <a href="${data.loginUrl}"
           style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:-0.01em">
          Acceder al panel &rarr;
        </a>
        <div style="margin-top:12px;font-size:12px;color:#94a3b8">
          ${data.loginUrl}
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #f1f5f9;padding-top:20px;text-align:center">
        <div style="font-size:12px;color:#94a3b8;line-height:1.7">
          Acceso válido por ${data.daysActive} días. Para cualquier duda contacta con el administrador del hotel.<br>
          <a href="mailto:app@servicecontrol.io" style="color:#64748b">app@servicecontrol.io</a>
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}

function credRow(label: string, value: string): string {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
      <div style="font-size:13px;font-weight:600;color:#475569">${label}</div>
      <div style="font-size:13px;color:#0f172a;font-family:monospace;background:#f1f5f9;padding:4px 10px;border-radius:6px">${value}</div>
    </div>`;
}

function stepRow(num: string, text: string): string {
  return `
    <div style="display:flex;align-items:flex-start;margin-bottom:12px">
      <div style="min-width:22px;height:22px;background:#0f172a;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:12px;margin-top:1px;flex-shrink:0">
        <span style="color:#fff;font-size:11px;font-weight:700">${num}</span>
      </div>
      <div style="font-size:13px;color:#475569;line-height:1.6">${text}</div>
    </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}