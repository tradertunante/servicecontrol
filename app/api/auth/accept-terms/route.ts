import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { supabaseWithToken } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const version = typeof body?.version === "string" ? body.version : "1.0";

  const { data: { user }, error: authError } = await supabaseWithToken(token).auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role to bypass RLS — identity already validated above.
  // The profiles_update_admin_scoped policy blocks superadmins from updating
  // their own row (sc_can_write_profile excludes the 'superadmin' role).
  const { error } = await supabaseAdmin()
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: version })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to record acceptance" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}