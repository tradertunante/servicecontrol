import "server-only";

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";
import { sendTrialWelcomeEmail } from "@/lib/email/sendTrialWelcomeEmail";

const DEMO_HOTEL_ID = "db3d0004-f4fe-4db5-8e8d-ae710d2c4d33";

function generatePassword(): string {
  return randomBytes(8).toString("base64url").slice(0, 12);
}

function sanitizeText(value: unknown): string {
  return String(value ?? "").trim().slice(0, 200);
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

  const admin = supabaseAdmin();

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
    if (authError?.message?.includes("already been registered")) {
      return NextResponse.json(
        { ok: false, error: "Este email ya tiene acceso al sandbox. Revisa tu bandeja de entrada." },
        { status: 409 }
      );
    }
    return jsonError("No se pudo crear la cuenta. Inténtalo de nuevo.", 500);
  }

  const userId = authData.user.id;

  // El trigger ya creó el perfil; solo actualizamos trial_hotel_name.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ trial_hotel_name: hotelName })
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
  });

  // Enviar email con credenciales
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.servicecontrol.io";
  await sendTrialWelcomeEmail({
    to: email,
    name,
    hotelName,
    email,
    password,
    loginUrl: `${appUrl}/login`,
  });

  return NextResponse.json({ ok: true });
}