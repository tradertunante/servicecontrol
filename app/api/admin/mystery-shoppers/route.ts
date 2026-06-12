import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMysteryShopperEmail } from "@/lib/email/sendMysteryShopperEmail";
import { logAdminAction } from "@/lib/admin/auditLog";

function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
  let pw = "";
  for (let i = 0; i < length; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

function generateLoginEmail(): string {
  const id = Math.random().toString(36).slice(2, 10);
  const domain = process.env.MYSTERY_SHOPPER_EMAIL_DOMAIN ?? "servicecontrol.io";
  return `ms-${id}@${domain}`;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = await resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email, contact_email, active, invited_at, access_expires_at")
      .eq("hotel_id", hotelResult.hotelId)
      .eq("role", "mystery_shopper")
      .order("invited_at", { ascending: false });

    if (error) return jsonDbError(error);

    // Enrich with audit count
    const ids = (data ?? []).map((r) => r.id);
    let auditCounts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: counts } = await admin
        .from("audit_runs")
        .select("executed_by")
        .eq("hotel_id", hotelResult.hotelId)
        .in("executed_by", ids)
        .eq("status", "submitted");

      (counts ?? []).forEach((row) => {
        if (row.executed_by) {
          auditCounts[row.executed_by] = (auditCounts[row.executed_by] ?? 0) + 1;
        }
      });
    }

    const shoppers = (data ?? []).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      email: (r as any).contact_email ?? r.email,
      login_email: r.email,
      active: r.active,
      invited_at: r.invited_at,
      access_expires_at: r.access_expires_at,
      audit_count: auditCounts[r.id] ?? 0,
      is_expired: r.access_expires_at ? new Date(r.access_expires_at) < new Date() : false,
    }));

    return NextResponse.json({ ok: true, shoppers });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = await resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const body = await request.json().catch(() => null);
    const contactEmail = String(body?.email ?? "").trim().toLowerCase();
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() || null : null;
    const daysActive = Math.max(1, Math.min(365, Number(body?.days_active ?? 7)));

    if (!contactEmail) return jsonError("El email es obligatorio.");

    // Generate a unique internal login email to avoid auth conflicts across hotels
    const loginEmail = generateLoginEmail();
    const password = generatePassword();
    const expiresAt = new Date(Date.now() + daysActive * 24 * 60 * 60 * 1000).toISOString();

    const admin = supabaseAdmin();

    // Create Supabase auth user with generated login email (always unique)
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "mystery_shopper",
        hotel_id: hotelResult.hotelId,
        active: true,
      },
    });

    if (authErr) return jsonError(authErr.message, 500);

    const userId = authUser.user.id;

    // Create profile — email = login email, contact_email = real email for correspondence
    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        email: loginEmail,
        contact_email: contactEmail,
        full_name: fullName,
        role: "mystery_shopper",
        hotel_id: hotelResult.hotelId,
        active: true,
        invited_at: new Date().toISOString(),
        access_expires_at: expiresAt,
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => null);
      return jsonDbError(profileErr, "Error creando perfil.");
    }

    // Grant access to all active areas of the hotel
    const { data: areas } = await admin
      .from("areas")
      .select("id")
      .eq("hotel_id", hotelResult.hotelId)
      .eq("active", true);

    if (areas && areas.length > 0) {
      const areaAccess = areas.map((a) => ({
        user_id: userId,
        hotel_id: hotelResult.hotelId,
        area_id: a.id,
      }));
      await admin.from("user_area_access").upsert(areaAccess, { onConflict: "user_id,area_id" });
    }

    // Send email with credentials (fire-and-forget)
    void (async () => {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://servicecontrol.io";
        const { data: hotel } = await admin.from("hotels").select("name").eq("id", hotelResult.hotelId).single();
        await sendMysteryShopperEmail({
          to: contactEmail,
          loginEmail,
          userName: fullName,
          hotelName: hotel?.name ?? "Su hotel",
          password,
          daysActive,
          loginUrl: `${appUrl}/login`,
        });
      } catch (err) {
        console.error("[mystery-shopper-email] Failed:", err);
      }
    })();

    void logAdminAction({
      hotelId: hotelResult.hotelId,
      actorId: caller.profile.id,
      actorName: caller.profile.full_name ?? caller.profile.id,
      targetId: userId,
      targetName: fullName ?? contactEmail,
      action: "mystery_shopper_created",
      newValue: `${daysActive} días`,
    });

    return NextResponse.json({ ok: true, user_id: userId });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}