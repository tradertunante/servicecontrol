import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canAssignRole, normalizeRole, type Role } from "@/lib/auth/permissions";
import { resolveRouteHotelScope } from "@/lib/auth/server";
import { sendWelcomeEmail } from "@/lib/email/sendWelcomeEmail";
import { shouldSendNotification } from "@/lib/notifications/notificationSettings";
import type { Profile } from "@/lib/types";

export type ManagedUserRow = {
  id: string;
  hotel_id: string | null;
  role: Role;
  active: boolean;
  full_name: string | null;
  email: string | null;
};

const KNOWN_ROLES: Role[] = [
  "superadmin",
  "admin",
  "general_manager",
  "manager",
  "auditor",
  "quality",
  "engineering",
  "it",
  "systems",
];

export function resolveManagedHotelId(profile: Profile) {
  return resolveRouteHotelScope(profile, null);
}

export function assertRoleAssignable(actorRole: Role, requestedRole: unknown) {
  const rawRole = String(requestedRole ?? "").trim().toLowerCase();
  if (!KNOWN_ROLES.includes(rawRole as Role)) {
    return {
      ok: false as const,
      error: "Rol inválido.",
      status: 400,
    };
  }

  const normalizedRole = normalizeRole(rawRole);
  if (!canAssignRole(actorRole, normalizedRole)) {
    return {
      ok: false as const,
      error: `No puedes asignar el rol "${normalizedRole}".`,
      status: 403,
    };
  }

  return { ok: true as const, role: normalizedRole };
}

export function canManageExistingUser(actorRole: Role, targetRole: Role) {
  if (actorRole === "superadmin") return true;
  if (actorRole === "admin") return targetRole !== "superadmin";
  return false;
}

export async function loadManagedUser(userId: string, hotelId?: string | null) {
  const admin = supabaseAdmin();
  let query = admin
    .from("profiles")
    .select("id, hotel_id, role, active, full_name, email")
    .eq("id", userId)
    .limit(1);

  if (hotelId) {
    query = query.eq("hotel_id", hotelId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    hotel_id: (data.hotel_id as string | null) ?? null,
    role: normalizeRole(data.role),
    active: data.active ?? true,
    full_name: (data.full_name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
  } satisfies ManagedUserRow;
}

export async function resolveManagedUserAccess(actorProfile: Profile, userId: string) {
  const hotelResult = resolveManagedHotelId(actorProfile);
  if (!hotelResult.ok) {
    return {
      ok: false as const,
      error: hotelResult.error,
      status: hotelResult.status,
    };
  }

  const target = await loadManagedUser(userId, hotelResult.hotelId);
  if (!target) {
    return {
      ok: false as const,
      error: "Usuario no encontrado.",
      status: 404,
    };
  }

  if (!canManageExistingUser(actorProfile.role, target.role)) {
    return {
      ok: false as const,
      error: "No puedes administrar este usuario.",
      status: 403,
    };
  }

  return {
    ok: true as const,
    hotelId: hotelResult.hotelId,
    target,
  };
}

export async function listManagedUsers(actorProfile: Profile) {
  const hotelResult = resolveManagedHotelId(actorProfile);
  if (!hotelResult.ok) {
    return {
      ok: false as const,
      error: hotelResult.error,
      status: hotelResult.status,
    };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, role, active, hotel_id")
    .eq("hotel_id", hotelResult.hotelId)
    .order("full_name", { ascending: true })
    .limit(200);

  if (error) {
    return {
      ok: false as const,
      error: error.message,
      status: 500,
    };
  }

  const users =
    actorProfile.role === "superadmin"
      ? data ?? []
      : (data ?? []).filter((row) => String(row.role ?? "").trim().toLowerCase() !== "superadmin");

  return {
    ok: true as const,
    hotelId: hotelResult.hotelId,
    users,
  };
}

export async function createManagedUser(
  actorProfile: Profile,
  payload: {
    email?: unknown;
    password?: unknown;
    full_name?: unknown;
    role?: unknown;
  }
) {
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const fullName =
    typeof payload.full_name === "string" ? payload.full_name.trim() || null : null;

  if (!email || !password) {
    return {
      ok: false as const,
      error: "Email y password son obligatorios.",
      status: 400,
    };
  }

  const hotelResult = resolveManagedHotelId(actorProfile);
  if (!hotelResult.ok) {
    return {
      ok: false as const,
      error: hotelResult.error,
      status: hotelResult.status,
    };
  }

  const roleResult = assertRoleAssignable(actorProfile.role, payload.role);
  if (!roleResult.ok) {
    return roleResult;
  }

  const admin = supabaseAdmin();
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: roleResult.role,
      hotel_id: hotelResult.hotelId,
      active: true,
    },
  });

  if (authErr) {
    return {
      ok: false as const,
      error: authErr.message,
      status: 500,
    };
  }

  const userId = authUser.user.id;

  // Explicit upsert as safety net in case the DB trigger is not deployed
  // or fires before user_metadata is available.
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: roleResult.role,
      hotel_id: hotelResult.hotelId,
      active: true,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => null);
    return {
      ok: false as const,
      error: `Error creando perfil: ${profileErr.message}`,
      status: 500,
    };
  }

  // Fetch hotel name for the welcome email (fire-and-forget, never blocks creation)
  void (async () => {
    try {
      const [{ data: hotel }, enabled] = await Promise.all([
        admin.from("hotels").select("name").eq("id", hotelResult.hotelId).single(),
        shouldSendNotification(hotelResult.hotelId, "new_user_email"),
      ]);

      if (!enabled) return;

      await sendWelcomeEmail({
        to: email,
        userName: fullName,
        hotelName: hotel?.name ?? "Su hotel",
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.servicecontrol.io"}/login`,
      });
    } catch (err) {
      console.error("[welcome-email] Failed to send to", email, err);
    }
  })();

  return {
    ok: true as const,
    userId,
  };
}

export async function deleteManagedUser(actorProfile: Profile, userId: string) {
  const targetUserId = String(userId ?? "").trim();
  if (!targetUserId) {
    return {
      ok: false as const,
      error: "Falta user_id.",
      status: 400,
    };
  }

  if (targetUserId === actorProfile.id) {
    return {
      ok: false as const,
      error: "No puedes borrarte a ti mismo.",
      status: 400,
    };
  }

  const targetScope = await resolveManagedUserAccess(actorProfile, targetUserId);
  if (!targetScope.ok) {
    return targetScope;
  }

  const admin = supabaseAdmin();
  const { error: delAuthErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (delAuthErr) {
    return {
      ok: false as const,
      error: delAuthErr.message ?? "No se pudo borrar el usuario de Auth.",
      status: 400,
    };
  }

  return { ok: true as const };
}
