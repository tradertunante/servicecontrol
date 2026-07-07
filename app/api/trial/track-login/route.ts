import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseWithToken } from "@/lib/supabaseServer";
import { getBearerTokenFromRequest } from "@/lib/auth/server";
import { updateBrevoContact } from "@/lib/integrations/brevo";
import { jsonError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  const token = getBearerTokenFromRequest(request);
  if (!token) return jsonError("No autorizado.", 401);

  const client = supabaseWithToken(token);
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user?.email) return jsonError("No autorizado.", 401);

  const admin = supabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, is_trial, first_login_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return jsonError("Perfil no encontrado.", 404);

  // Only track trial users that haven't logged in before
  if (!profile.is_trial || profile.first_login_at) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  const now = new Date().toISOString();

  await admin
    .from("profiles")
    .update({ first_login_at: now })
    .eq("id", user.id);

  await updateBrevoContact(user.email, { FIRST_LOGIN_AT: now });

  return NextResponse.json({ ok: true, tracked: true });
}