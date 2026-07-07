import "server-only";

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logger } from "@/lib/logger";
import { jsonError } from "@/lib/api/response";
import { TRIAL_ENABLED_PACKS } from "@/lib/auth/packs";
import { sendTrialWelcomeEmail } from "@/lib/email/sendTrialWelcomeEmail";
import { addTrialLeadToBrevo } from "@/lib/integrations/brevo";
import { addTrialLeadToNotion } from "@/lib/integrations/notion";

const DEMO_HOTEL_ID = process.env.TRIAL_DEMO_HOTEL_ID;

function generatePassword(): string {
  return randomBytes(8).toString("base64url").slice(0, 12);
}

const RATE_LIMIT_PER_HOUR = 5;

function sanitizeText(value: unknown): string {
  return String(value ?? "").trim().slice(0, 200);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    return await handleRegister(request);
  } catch (err) {
    logger.error("trial_register_unexpected_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError("No se pudo crear la cuenta. Inténtalo de nuevo.", 500);
  }
}

async function handleRegister(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const name = sanitizeText(body?.name);
  const email = sanitizeText(body?.email).toLowerCase();
  const hotelName = sanitizeText(body?.hotel_name);

  if (!name || !email || !hotelName) {
    return jsonError("Nombre, email y nombre del hotel son obligatorios.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Email no válido.", 400);
  }

  if (!DEMO_HOTEL_ID) return jsonError("Sandbox no disponible. Contacta con soporte.", 503);

  const ip = getClientIp(request);
  const admin = supabaseAdmin();

  // Rate limit por IP: máx RATE_LIMIT_PER_HOUR registros en la última hora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("trial_leads")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return jsonError("Demasiados intentos. Inténtalo de nuevo más tarde.", 429);
  }

  // Comprobar si el email ya tiene cuenta trial
  const { data: existing } = await admin
    .from("trial_leads")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "Este email ya tiene acceso al sandbox. Revisa tu bandeja de entrada." },
      { status: 409 }
    );
  }

  const password = generatePassword();

  // Crear usuario en Supabase Auth.
  // El trigger sync_profile_from_auth_user lee raw_user_meta_data para crear el perfil,
  // por lo que hotel_id (NOT NULL en profiles) debe venir en los metadatos.
  // Rol "quality", no "admin": el hotel demo es compartido entre todos los trials;
  // quality conserva la experiencia completa (dashboard, auditar, correctivas,
  // formación) sin poder gestionar usuarios, settings del hotel ni borrar runs.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: "quality",
      hotel_id: DEMO_HOTEL_ID,
      active: true,
      is_trial: true,
    },
  });

  if (authError || !authData.user) {
    console.error("[trial/register] auth error:", authError?.message, authError?.status);
    const msg = authError?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered") || authError?.status === 422) {
      return NextResponse.json(
        { ok: false, error: "Este email ya tiene acceso al sandbox. Revisa tu bandeja de entrada." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo crear la cuenta." },
      { status: 500 }
    );
  }

  const userId = authData.user.id;

  const trialExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // El trigger ya creó el perfil; actualizamos trial_hotel_name y trial_expires_at.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ trial_hotel_name: hotelName, trial_expires_at: trialExpiresAt })
    .eq("id", userId);

  if (profileError) {
    // Rollback: eliminar usuario si la actualización del perfil falla
    await admin.auth.admin.deleteUser(userId);
    return jsonError("Error al configurar la cuenta. Inténtalo de nuevo.", 500);
  }

  // Asegurar que el hotel demo tiene los packs del plan Operaciones (sandbox)
  await admin
    .from("hotels")
    .update({ enabled_packs: TRIAL_ENABLED_PACKS })
    .eq("id", DEMO_HOTEL_ID);

  // Guardar lead para follow-up
  await admin.from("trial_leads").insert({
    name,
    email,
    hotel_name: hotelName,
    ip_address: ip,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://servicecontrol.io";

  // El email lleva la contraseña: si falla, la cuenta es inutilizable y el
  // reintento del usuario chocaría con el 409 de "email ya registrado".
  // Rollback completo y 500 para que pueda reintentar de verdad.
  try {
    await sendTrialWelcomeEmail({
      to: email,
      name,
      hotelName,
      email,
      password,
      loginUrl: `${appUrl}/login`,
      demoUrl: `${appUrl}/demo`,
    });
  } catch (emailErr) {
    logger.error("trial_register_welcome_email_failed", {
      error: emailErr instanceof Error ? emailErr.message : String(emailErr),
    });
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("trial_leads").delete().eq("email", email);
    return jsonError("No se pudo enviar el email de acceso. Inténtalo de nuevo.", 500);
  }

  // CRM y Notion fuera del camino crítico: su fallo no debe romper el alta
  waitUntil(
    Promise.allSettled([
      addTrialLeadToBrevo(email, name, hotelName, trialExpiresAt),
      addTrialLeadToNotion(email, hotelName),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === "rejected") {
          logger.warn("trial_register_crm_sync_failed", {
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      }
    })
  );

  return NextResponse.json({ ok: true });
}