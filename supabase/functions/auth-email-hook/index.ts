/**
 * Auth Email Hook — Supabase Send Email Hook
 *
 * Intercepts all Supabase auth emails (recovery, signup, magic_link, invite,
 * email_change) and sends them via Resend with ServiceControl branding.
 *
 * Configure in Supabase Dashboard:
 *   Authentication → Hooks → Send Email → HTTP (this function URL)
 *   Set SEND_EMAIL_HOOK_SECRET in Edge Function secrets.
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "no-reply@servicecontrol.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmailActionType =
  | "signup"
  | "recovery"
  | "magic_link"
  | "invite"
  | "email_change_new"
  | "email_change_current"
  | "reauthentication";

type HookPayload = {
  user: {
    id: string;
    email: string;
    user_metadata?: { full_name?: string; [key: string]: unknown };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

// ---------------------------------------------------------------------------
// JWT verification (HS256)
// ---------------------------------------------------------------------------

async function verifyHookJWT(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const fixB64 = (s: string) =>
      s
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(s.length / 4) * 4, "=");

    const signature = Uint8Array.from(atob(fixB64(parts[2])), (c) =>
      c.charCodeAt(0)
    );
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    return await crypto.subtle.verify("HMAC", key, signature, data);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Confirmation URL builder
// ---------------------------------------------------------------------------

function buildConfirmUrl(payload: HookPayload): string {
  const { token_hash, email_action_type, redirect_to } = payload.email_data;
  const base = `${SUPABASE_URL}/auth/v1/verify`;
  const params = new URLSearchParams({
    token: token_hash,
    type: email_action_type,
    redirect_to,
  });
  return `${base}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// HTML email builders
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px 56px">

    <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0">
      <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.02em">ServiceControl</div>
      <div style="color:#64748b;font-size:12px;margin-top:3px;font-weight:500;letter-spacing:0.02em">Gestión de calidad operativa</div>
    </div>

    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:36px 32px 32px;border-radius:0 0 12px 12px">
      ${body}

      <div style="border-top:1px solid #f1f5f9;margin-top:32px;padding-top:20px;text-align:center">
        <div style="font-size:12px;color:#94a3b8;line-height:1.7">
          ServiceControl · Este mensaje fue generado automáticamente.<br>
          No responder a este correo.
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `
    <div style="text-align:center;margin:28px 0">
      <a href="${href}"
         style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:-0.01em">
        ${label} &rarr;
      </a>
    </div>`;
}

function fallbackLink(href: string): string {
  return `<div style="margin-top:16px;font-size:12px;color:#94a3b8;text-align:center;word-break:break-all">
    O copia este enlace en tu navegador:<br>
    <span style="color:#475569">${escapeHtml(href)}</span>
  </div>`;
}

// --- recovery ---
function buildRecoveryEmail(displayName: string, actionUrl: string): string {
  return emailShell(`
    <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;margin-bottom:10px">
      Restablece tu contraseña
    </div>
    <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:4px">
      Hola, ${escapeHtml(displayName)}.<br><br>
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en ServiceControl.
      Haz clic en el botón de abajo para crear una nueva contraseña.
    </div>
    ${ctaButton(actionUrl, "Restablecer contraseña")}
    <div style="padding:14px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.6">
      Si no solicitaste restablecer tu contraseña, ignora este mensaje.
      Tu contraseña actual no se verá afectada.
      El enlace expirará en <strong>1 hora</strong>.
    </div>
    ${fallbackLink(actionUrl)}
  `);
}

// --- signup (email confirmation) ---
function buildSignupEmail(displayName: string, actionUrl: string): string {
  return emailShell(`
    <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;margin-bottom:10px">
      Confirma tu cuenta
    </div>
    <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:4px">
      Hola, ${escapeHtml(displayName)}.<br><br>
      Confirma tu dirección de correo electrónico para activar tu cuenta en ServiceControl.
    </div>
    ${ctaButton(actionUrl, "Confirmar email")}
    <div style="padding:14px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.6">
      Si no creaste esta cuenta, ignora este mensaje.
      El enlace expirará en <strong>24 horas</strong>.
    </div>
    ${fallbackLink(actionUrl)}
  `);
}

// --- magic link ---
function buildMagicLinkEmail(displayName: string, actionUrl: string): string {
  return emailShell(`
    <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;margin-bottom:10px">
      Tu enlace de acceso
    </div>
    <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:4px">
      Hola, ${escapeHtml(displayName)}.<br><br>
      Usa el botón de abajo para acceder a ServiceControl sin contraseña.
      Este enlace es de un solo uso.
    </div>
    ${ctaButton(actionUrl, "Acceder a ServiceControl")}
    <div style="padding:14px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.6">
      Si no solicitaste este enlace, ignora este mensaje.
      Expirará en <strong>1 hora</strong>.
    </div>
    ${fallbackLink(actionUrl)}
  `);
}

// --- invite ---
function buildInviteEmail(displayName: string, actionUrl: string): string {
  return emailShell(`
    <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;margin-bottom:10px">
      Te han invitado a ServiceControl
    </div>
    <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:4px">
      Hola, ${escapeHtml(displayName)}.<br><br>
      Has sido invitado a unirte a ServiceControl.
      Haz clic en el botón de abajo para crear tu contraseña y activar tu cuenta.
    </div>
    ${ctaButton(actionUrl, "Aceptar invitación")}
    <div style="padding:14px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.6">
      El enlace expirará en <strong>24 horas</strong>.
      Si no esperabas esta invitación, ignora este mensaje.
    </div>
    ${fallbackLink(actionUrl)}
  `);
}

// --- email change ---
function buildEmailChangeEmail(
  displayName: string,
  actionUrl: string,
  isCurrent: boolean
): string {
  const title = isCurrent
    ? "Confirma el cambio de email"
    : "Confirma tu nuevo email";
  const body = isCurrent
    ? "Alguien solicitó cambiar el email de tu cuenta en ServiceControl. Confirma el cambio desde tu dirección actual."
    : "Confirma tu nueva dirección de correo para completar el cambio de email en ServiceControl.";
  const cta = isCurrent ? "Confirmar cambio" : "Confirmar nuevo email";

  return emailShell(`
    <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;margin-bottom:10px">
      ${title}
    </div>
    <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:4px">
      Hola, ${escapeHtml(displayName)}.<br><br>
      ${body}
    </div>
    ${ctaButton(actionUrl, cta)}
    <div style="padding:14px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.6">
      Si no solicitaste este cambio, ignora este mensaje y tu email actual seguirá activo.
      El enlace expirará en <strong>24 horas</strong>.
    </div>
    ${fallbackLink(actionUrl)}
  `);
}

// ---------------------------------------------------------------------------
// Email dispatch
// ---------------------------------------------------------------------------

function resolveSubject(type: EmailActionType): string {
  switch (type) {
    case "recovery":
      return "Restablece tu contraseña · ServiceControl";
    case "signup":
      return "Confirma tu cuenta · ServiceControl";
    case "magic_link":
      return "Tu enlace de acceso · ServiceControl";
    case "invite":
      return "Invitación a ServiceControl";
    case "email_change_new":
    case "email_change_current":
      return "Confirma el cambio de email · ServiceControl";
    case "reauthentication":
      return "Código de verificación · ServiceControl";
    default:
      return "Acción requerida · ServiceControl";
  }
}

function resolveHtml(
  type: EmailActionType,
  displayName: string,
  actionUrl: string
): string {
  switch (type) {
    case "recovery":
      return buildRecoveryEmail(displayName, actionUrl);
    case "signup":
      return buildSignupEmail(displayName, actionUrl);
    case "magic_link":
      return buildMagicLinkEmail(displayName, actionUrl);
    case "invite":
      return buildInviteEmail(displayName, actionUrl);
    case "email_change_current":
      return buildEmailChangeEmail(displayName, actionUrl, true);
    case "email_change_new":
      return buildEmailChangeEmail(displayName, actionUrl, false);
    default:
      // Fallback genérico para reauthentication u otros
      return buildRecoveryEmail(displayName, actionUrl);
  }
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ServiceControl <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify hook secret
  if (HOOK_SECRET) {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const valid = await verifyHookJWT(token, HOOK_SECRET);
    if (!valid) {
      console.error("[auth-email-hook] Invalid hook JWT");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let payload: HookPayload;
  try {
    payload = (await req.json()) as HookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user, email_data } = payload;
  const type = email_data?.email_action_type;
  const recipientEmail = user?.email;

  if (!recipientEmail || !type) {
    return new Response(JSON.stringify({ error: "Missing email or type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const displayName =
    user.user_metadata?.full_name?.trim() ||
    recipientEmail.split("@")[0];

  const actionUrl = buildConfirmUrl(payload);
  const subject = resolveSubject(type);
  const html = resolveHtml(type, displayName, actionUrl);

  try {
    await sendViaResend(recipientEmail, subject, html);
    console.log(`[auth-email-hook] Sent '${type}' email to ${recipientEmail}`);
  } catch (err) {
    console.error(`[auth-email-hook] Failed for ${recipientEmail}:`, err);
    // Return 500 so Supabase can log the failure, but don't leak details
    return new Response(JSON.stringify({ error: "Email delivery failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Supabase requires this exact response to consider the hook handled
  return new Response(JSON.stringify({ message: "handled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});