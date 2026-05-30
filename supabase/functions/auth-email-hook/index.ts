// @ts-nocheck
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

// Startup checks — appear in Edge Function boot logs
if (!RESEND_API_KEY) {
  console.error("[auth-email-hook] STARTUP ERROR: RESEND_API_KEY is not set. Emails will fail silently.");
}
if (!HOOK_SECRET) {
  console.warn("[auth-email-hook] STARTUP WARN: SEND_EMAIL_HOOK_SECRET is not set. Hook auth is disabled.");
}
if (!SUPABASE_URL) {
  console.error("[auth-email-hook] STARTUP ERROR: SUPABASE_URL is not set. Confirmation URLs will be malformed.");
}

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
// Hook auth verification — Standard Webhooks (v1,whsec_<base64>)
// Supabase sends: webhook-id, webhook-timestamp, webhook-signature headers.
// Signed content: "{webhook-id}.{webhook-timestamp}.{raw body}"
// ---------------------------------------------------------------------------

async function verifyStandardWebhook(
  req: Request,
  rawBody: string,
  secret: string
): Promise<boolean> {
  try {
    const webhookId        = req.headers.get("webhook-id") ?? "";
    const webhookTimestamp = req.headers.get("webhook-timestamp") ?? "";
    const webhookSignature = req.headers.get("webhook-signature") ?? "";

    if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

    // Secret format: "v1,whsec_<base64>" → decode the base64 bytes
    const base64Part  = secret.replace(/^v1,whsec_/, "");
    const secretBytes = Uint8Array.from(atob(base64Part), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const sigBytes      = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
    const expected      = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

    // webhook-signature may contain multiple space-separated "v1,<sig>" entries
    return webhookSignature.split(" ").some((entry) => {
      const [, sigValue] = entry.split(",");
      return sigValue === expected;
    });
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

function buildEmailChangeCurrentEmail(displayName: string, actionUrl: string): string {
  return emailShell(`
    <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;margin-bottom:10px">
      Confirma el cambio de email
    </div>
    <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:4px">
      Hola, ${escapeHtml(displayName)}.<br><br>
      Alguien solicitó cambiar el email de tu cuenta en ServiceControl. Confirma el cambio desde tu dirección actual.
    </div>
    ${ctaButton(actionUrl, "Confirmar cambio")}
    <div style="padding:14px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.6">
      Si no solicitaste este cambio, ignora este mensaje y tu email actual seguirá activo.
      El enlace expirará en <strong>24 horas</strong>.
    </div>
    ${fallbackLink(actionUrl)}
  `);
}

function buildEmailChangeNewEmail(displayName: string, actionUrl: string): string {
  return emailShell(`
    <div style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;margin-bottom:10px">
      Confirma tu nuevo email
    </div>
    <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:4px">
      Hola, ${escapeHtml(displayName)}.<br><br>
      Confirma tu nueva dirección de correo para completar el cambio de email en ServiceControl.
    </div>
    ${ctaButton(actionUrl, "Confirmar nuevo email")}
    <div style="padding:14px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.6">
      Si no solicitaste este cambio, ignora este mensaje y tu email actual seguirá activo.
      El enlace expirará en <strong>24 horas</strong>.
    </div>
    ${fallbackLink(actionUrl)}
  `);
}

// ---------------------------------------------------------------------------
// Email dispatch — single lookup table per action type
// ---------------------------------------------------------------------------

type EmailConfig = { subject: string; html: (displayName: string, actionUrl: string) => string };

const EMAIL_CONFIG: Partial<Record<EmailActionType, EmailConfig>> = {
  recovery:             { subject: "Restablece tu contraseña · ServiceControl",    html: buildRecoveryEmail },
  signup:               { subject: "Confirma tu cuenta · ServiceControl",           html: buildSignupEmail },
  magic_link:           { subject: "Tu enlace de acceso · ServiceControl",          html: buildMagicLinkEmail },
  invite:               { subject: "Invitación a ServiceControl",                   html: buildInviteEmail },
  email_change_current: { subject: "Confirma el cambio de email · ServiceControl",  html: buildEmailChangeCurrentEmail },
  email_change_new:     { subject: "Confirma el cambio de email · ServiceControl",  html: buildEmailChangeNewEmail },
  reauthentication:     { subject: "Código de verificación · ServiceControl",       html: buildRecoveryEmail },
};

const FALLBACK_CONFIG: EmailConfig = {
  subject: "Acción requerida · ServiceControl",
  html: buildRecoveryEmail,
};

async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error("Resend API key is not configured (RESEND_API_KEY secret missing)");
  }

  const payload = {
    from: `ServiceControl <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  };

  console.log(`[auth-email-hook] Calling Resend: to=${to} from=${FROM_EMAIL} subject="${subject}"`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${responseText}`);
  }

  console.log(`[auth-email-hook] Resend accepted: ${responseText}`);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  console.log(`[auth-email-hook] Request: ${req.method} from ${req.headers.get("x-forwarded-for") ?? "unknown"}`);

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Verify hook secret (Standard Webhooks format)
  if (HOOK_SECRET) {
    const valid = await verifyStandardWebhook(req, rawBody, HOOK_SECRET);
    if (!valid) {
      console.error("[auth-email-hook] UNAUTHORIZED: Standard Webhook signature invalid. Check SEND_EMAIL_HOOK_SECRET matches the hook secret in Auth → Hooks.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody) as HookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user, email_data } = payload;
  const type = email_data?.email_action_type;
  const recipientEmail = user?.email;

  console.log(`[auth-email-hook] Payload: type=${type ?? "MISSING"} recipient=${recipientEmail ?? "MISSING"}`);

  if (!recipientEmail || !type) {
    console.error(`[auth-email-hook] Bad payload — email=${recipientEmail} type=${type}`);
    return new Response(JSON.stringify({ error: "Missing email or type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const displayName =
    user.user_metadata?.full_name?.trim() ||
    recipientEmail.split("@")[0];

  const actionUrl = buildConfirmUrl(payload);
  const config = EMAIL_CONFIG[type] ?? FALLBACK_CONFIG;
  const subject = config.subject;
  const html = config.html(displayName, actionUrl);

  try {
    await sendViaResend(recipientEmail, subject, html);
    console.log(`[auth-email-hook] OK: sent '${type}' to ${recipientEmail}`);
  } catch (err) {
    // Log but do NOT return 500 — a 500 causes Supabase to abort the auth
    // operation (e.g. "Database error creating new user"). Email delivery
    // failure must never block user creation or password recovery flows.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[auth-email-hook] SEND FAILED for ${recipientEmail} (type=${type}): ${message}`);
  }

  // Supabase requires this exact response to consider the hook handled
  return new Response(JSON.stringify({ message: "handled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});