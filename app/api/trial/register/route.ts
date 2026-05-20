import "server-only";

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";
import { sendTrialWelcomeEmail } from "@/lib/email/sendTrialWelcomeEmail";
import { addTrialLeadToBrevo } from "@/lib/brevo";
import { addTrialLeadToNotion } from "@/lib/notion";

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
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: "admin",
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

  // Guardar lead para follow-up
  await admin.from("trial_leads").insert({
    name,
    email,
    hotel_name: hotelName,
    ip_address: ip,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.servicecontrol.io";
  await Promise.all([
    sendTrialWelcomeEmail({
      to: email,
      name,
      hotelName,
      email,
      password,
      loginUrl: `${appUrl}/login`,
      demoUrl: `${appUrl}/demo`,
    }),
    addTrialLeadToBrevo(email, name, hotelName, trialExpiresAt),
    addTrialLeadToNotion(email, hotelName),
  ]);

  return NextResponse.json({ ok: true });
}