import "server-only";

import { getResend } from "./resend";

type MysteryShopperEmailData = {
  to: string;
  loginEmail: string;
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
    subject: `Tu acceso Mystery Shopper · ${data.hotelName}`,
    html: buildHtml({ ...data, displayName }),
    text: buildText({ ...data, displayName }),
    headers: { "List-Unsubscribe": "<mailto:app@servicecontrol.io?subject=Unsubscribe>" },
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
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 16px 48px">

  <!-- Top label -->
  <div style="text-align:center;margin-bottom:24px">
    <span style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 14px;border-radius:20px">
      Mystery Shopper · ${escapeHtml(data.hotelName)}
    </span>
  </div>

  <!-- Card -->
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4)">

    <!-- Hero -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:40px 40px 36px;position:relative">
      <div style="font-size:13px;font-weight:600;color:#64748b;letter-spacing:0.04em;margin-bottom:10px;text-transform:uppercase">ServiceControl</div>
      <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;margin-bottom:10px">
        Hola, ${escapeHtml(data.displayName)}
      </div>
      <div style="font-size:15px;color:#94a3b8;line-height:1.6">
        Tienes acceso como <span style="color:#e2e8f0;font-weight:600">Mystery Shopper</span> en<br>
        <span style="color:#f8fafc;font-weight:700">${escapeHtml(data.hotelName)}</span>
      </div>
      <!-- Expiry badge -->
      <div style="display:inline-block;margin-top:18px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 14px">
        <span style="font-size:12px;color:#94a3b8">Acceso activo durante </span>
        <span style="font-size:13px;color:#f1f5f9;font-weight:700">${data.daysActive} días</span>
      </div>
    </div>

    <!-- Credentials block -->
    <div style="padding:32px 40px 0">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:16px">
        Tus credenciales de acceso
      </div>

      <!-- Email row -->
      <div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px">Email</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:14px;font-family:'Courier New',Courier,monospace;color:#0f172a;font-weight:600;word-break:break-all">${escapeHtml(data.loginEmail)}</span>
        </div>
      </div>

      <!-- Password row -->
      <div style="margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px">Contraseña</div>
        <div style="background:#f8fafc;border:2px solid #0f172a;border-radius:8px;padding:12px 16px">
          <span style="font-size:16px;font-family:'Courier New',Courier,monospace;color:#0f172a;font-weight:700;letter-spacing:0.06em">${escapeHtml(data.password)}</span>
        </div>
      </div>

      <div style="font-size:12px;color:#94a3b8;margin-bottom:28px;margin-top:10px;line-height:1.5">
        Guarda estas credenciales. Una vez accedas podrás cambiar la contraseña desde tu perfil.
      </div>

      <!-- Divider -->
      <div style="height:1px;background:#f1f5f9;margin-bottom:28px"></div>
    </div>

    <!-- How it works -->
    <div style="padding:0 40px 28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:20px">
        Cómo funciona
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${stepRow("1", "Inicia sesión", "Con el email y contraseña de arriba en el botón de abajo.")}
        ${stepRow("2", "Elige área y auditoría", "Verás todas las áreas del hotel con sus auditorías disponibles.")}
        ${stepRow("3", "Completa el formulario", "Responde cada punto honestamente. Las fotos son opcionales.")}
        ${stepRow("4", "Guarda automáticamente", "Puedes cerrar y continuar más tarde sin perder nada.")}
        ${stepRow("5", "Envía el reporte", "Cuando termines, pulsa <strong style=\"color:#0f172a\">Enviar Reporte</strong> para que el equipo lo reciba.")}
      </table>
    </div>

    <!-- CTA -->
    <div style="padding:0 40px 36px;text-align:center">
      <a href="${data.loginUrl}"
         style="display:inline-block;background:#0f172a;color:#ffffff;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:-0.01em;box-shadow:0 4px 14px rgba(15,23,42,0.3)">
        Acceder al panel &rarr;
      </a>
      <div style="margin-top:10px;font-size:12px;color:#94a3b8">${data.loginUrl}</div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center">
      <div style="font-size:12px;color:#94a3b8;line-height:1.7">
        Acceso válido hasta ${expiryDate(data.daysActive)}. ¿Dudas? Contacta con el administrador del hotel<br>
        o escríbenos a <a href="mailto:app@servicecontrol.io" style="color:#64748b;text-decoration:none;font-weight:600">app@servicecontrol.io</a>
      </div>
    </div>

  </div>

  <!-- Bottom note -->
  <div style="text-align:center;margin-top:20px">
    <div style="font-size:11px;color:#475569">Este mensaje fue generado automáticamente por ServiceControl</div>
  </div>

</div>
</body>
</html>`;
}

function buildText(data: MysteryShopperEmailData & { displayName: string }): string {
  return [
    `Tu acceso Mystery Shopper · ${data.hotelName}`,
    "",
    `Hola, ${data.displayName}`,
    "",
    `Tienes acceso como Mystery Shopper en ${data.hotelName}.`,
    `Acceso activo durante ${data.daysActive} días.`,
    "",
    "--- TUS CREDENCIALES ---",
    `Email: ${data.loginEmail}`,
    `Contraseña: ${data.password}`,
    "",
    "Guarda estas credenciales. Una vez accedas podrás cambiar la contraseña desde tu perfil.",
    "",
    "--- CÓMO FUNCIONA ---",
    "1. Inicia sesión con el email y contraseña de arriba.",
    "2. Elige área y auditoría.",
    "3. Completa el formulario honestamente. Las fotos son opcionales.",
    "4. Guarda automáticamente. Puedes cerrar y continuar más tarde sin perder nada.",
    '5. Cuando termines, pulsa "Enviar Reporte" para que el equipo lo reciba.',
    "",
    `Acceder al panel: ${data.loginUrl}`,
    "",
    `Acceso válido hasta ${expiryDate(data.daysActive)}.`,
    "¿Dudas? Contacta con el administrador del hotel o escríbenos a app@servicecontrol.io",
    "",
    "Este mensaje fue generado automáticamente por ServiceControl.",
  ].join("\n");
}

function stepRow(num: string, title: string, text: string): string {
  return `<tr>
    <td style="width:36px;vertical-align:top;padding-bottom:16px">
      <div style="width:28px;height:28px;background:#0f172a;border-radius:8px;text-align:center;line-height:28px;font-size:12px;font-weight:800;color:#ffffff">${num}</div>
    </td>
    <td style="padding-bottom:16px;padding-left:12px;vertical-align:top">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:2px">${title}</div>
      <div style="font-size:13px;color:#64748b;line-height:1.5">${text}</div>
    </td>
  </tr>`;
}

function expiryDate(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}