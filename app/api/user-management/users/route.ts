// app/api/user-management/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "admin" | "manager" | "auditor" | "superadmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getCaller(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, error: "No autorizado (sin token)." };

  // Cliente ANON + token para validar caller (NO service key aquí)
  const client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: callerAuth } = await client.auth.getUser(token);
  if (!callerAuth?.user) return { ok: false as const, error: "No autorizado." };

  const callerId = callerAuth.user.id;

  const { data: callerProfile, error: callerErr } = await client
    .from("profiles")
    .select("id, hotel_id, role, active")
    .eq("id", callerId)
    .single();

  if (callerErr || !callerProfile) {
    return { ok: false as const, error: "No se pudo validar tu perfil." };
  }

  const role = callerProfile.role as Role;
  const isAllowed = (callerProfile.active ?? true) && (role === "admin" || role === "superadmin");
  if (!isAllowed) {
    return { ok: false as const, error: "Forbidden: solo admin/superadmin." };
  }

  return {
    ok: true as const,
    token,
    callerProfile: {
      id: callerProfile.id,
      hotel_id: callerProfile.hotel_id as string | null,
      role,
    },
  };
}

/**
 * GET /api/user-management/users?hotel_id=...
 * Devuelve:
 * - profiles del hotel
 * - email desde auth.users
 * - username derivado del email
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getCaller(req);
    if (!caller.ok) return jsonError(caller.error, 401);

    const url = new URL(req.url);
    const hotelId = (url.searchParams.get("hotel_id") || "").trim();
    if (!hotelId) return jsonError("Falta hotel_id.", 400);

    // admin solo su hotel; superadmin puede cualquier hotel
    if (caller.callerProfile.role !== "superadmin" && hotelId !== caller.callerProfile.hotel_id) {
      return jsonError("Forbidden: hotel incorrecto.", 403);
    }

    const admin = supabaseAdmin();

    // 1) profiles (tu tabla)
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, full_name, role, hotel_id, active, created_at")
      .eq("hotel_id", hotelId)
      .order("full_name", { ascending: true });

    if (pErr) return jsonError(pErr.message, 500);

    const ids = (profiles || []).map((p) => p.id);
    const idsSet = new Set(ids);

    // 2) emails desde auth.users (paginado)
    const emailsById = new Map<string, string | null>();

    if (ids.length > 0) {
      let page = 1;
      const perPage = 1000;
      const maxPages = 50;

      while (page <= maxPages && emailsById.size < idsSet.size) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) return jsonError(error.message, 500);

        for (const u of data.users) {
          if (idsSet.has(u.id)) emailsById.set(u.id, u.email ?? null);
        }

        if (!data.users || data.users.length < perPage) break;
        page++;
      }
    }

    const users = (profiles || []).map((p) => {
      const email = emailsById.get(p.id) ?? null;
      const username = email ? email : p.id;

      return {
        id: p.id,
        username,
        full_name: p.full_name ?? "",
        email,
        position: "", // (si luego añades columna 'position' a profiles, lo enchufamos)
        role: (p.role as Role) ?? "auditor",
        status: (p.active ?? true) ? "active" : "inactive",
        mfa: "—", // (si algún día quieres MFA real, se puede)
      };
    });

    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return jsonError(e?.message ?? "Error inesperado.", 500);
  }
}