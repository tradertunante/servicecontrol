import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canAssignRole, normalizeRole, type Role } from "@/lib/auth/permissions";
import { resolveRouteHotelScope } from "@/lib/auth/server";
import { sendWelcomeEmail } from "@/lib/email/sendWelcomeEmail";
import { shouldSendNotification } from "@/lib/notifications/notificationSettings";
import { canAddUser } from "@/lib/billing/enforcement";
import type { Profile } from "@/lib/types";

export type ManagedUserRow = {
  id: string;
  hotel_id: string | null;
  role: Role;
  active: boolean;
  full_name: string | null;
  email: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  invited_at: string | null;
  areas: { id: string; name: string }[];
  audit_run_count: number;
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
  "mystery_shopper",
];

export function resolveManagedHotelId(profile: Profile) {
  return resolveRouteHotelScope(profile, null);
}

// Supabase's admin.generateLink() sometimes returns an `action_link` whose
// `redirect_to` param is truncated to the site's root, dropping the path we
// asked for. Rebuilding the verify URL from `hashed_token` sidesteps that and
// guarantees the link lands on `${appUrl}/reset-password`.
export function buildRecoveryActivationLink(
  linkData:
    | { properties?: { hashed_token?: string | null; action_link?: string | null } | null }
    | null
    | undefined,
  appUrl: string
): string | null {
  const hashedToken = linkData?.properties?.hashed_token;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!hashedToken || !supabaseUrl) return linkData?.properties?.action_link ?? null;

  const redirectTo = encodeURIComponent(`${appUrl}/reset-password`);
  return `${supabaseUrl}/auth/v1/verify?token=${hashedToken}&type=recovery&redirect_to=${redirectTo}`;
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

export type HotelMembershipState = { role: string; active: boolean };

// Membresía de un usuario en un hotel concreto (null si no tiene acceso a ese hotel).
export async function findHotelMembership(userId: string, hotelId: string): Promise<HotelMembershipState | null> {
  const { data, error } = await supabaseAdmin()
    .from("hotel_memberships")
    .select("role, active")
    .eq("user_id", userId)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (error) throw error;
  return data ? { role: data.role, active: data.active } : null;
}

async function countOtherMemberships(userId: string, hotelId: string) {
  const { count, error } = await supabaseAdmin()
    .from("hotel_memberships")
    .select("hotel_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("hotel_id", hotelId);
  if (error) throw error;
  return count ?? 0;
}

async function countOtherActiveMemberships(userId: string, hotelId: string) {
  const { count, error } = await supabaseAdmin()
    .from("hotel_memberships")
    .select("hotel_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true)
    .neq("hotel_id", hotelId);
  if (error) throw error;
  return count ?? 0;
}

// Con hotelId, rol y estado son los de la membresía de ESE hotel. Sin membresía
// se acepta el perfil sólo si su hotel activo es ese (superadmin / datos legacy).
export async function loadManagedUser(userId: string, hotelId?: string | null) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id, hotel_id, role, active, full_name, email")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let role: string | null = data.role;
  let hotelIdOut: string | null = data.hotel_id ?? null;
  let active = data.active ?? true;

  if (hotelId) {
    const membership = await findHotelMembership(userId, hotelId);
    if (membership) {
      role = membership.role;
      hotelIdOut = hotelId;
      active = (data.active ?? true) && membership.active;
    } else if (data.hotel_id !== hotelId) {
      return null;
    }
  }

  return {
    id: String(data.id),
    hotel_id: hotelIdOut,
    role: normalizeRole(role),
    active,
    full_name: (data.full_name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    last_sign_in_at: null,
    email_confirmed_at: null,
    invited_at: null,
    areas: [],
    audit_run_count: 0,
  } satisfies ManagedUserRow;
}

// Cambia rol y activo del usuario en un hotel. profiles.role/hotel_id se
// sincronizan por trigger cuando ese hotel es el activo.
export async function applyMembershipChange(
  userId: string,
  hotelId: string,
  changes: { role: string; active: boolean }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const admin = supabaseAdmin();

  const { error: memberErr } = await admin
    .from("hotel_memberships")
    .update({ role: changes.role, active: changes.active })
    .eq("user_id", userId)
    .eq("hotel_id", hotelId);
  if (memberErr) return { ok: false, error: memberErr.message, status: 500 };

  if (!changes.active) {
    // Sin otros hoteles activos, el usuario queda desactivado globalmente (como antes).
    if ((await countOtherActiveMemberships(userId, hotelId)) === 0) {
      const { error } = await admin.from("profiles").update({ active: false }).eq("id", userId);
      if (error) return { ok: false, error: error.message, status: 500 };
    }
    return { ok: true };
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("hotel_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) return { ok: false, error: profileErr.message, status: 500 };

  // Reactivar: el usuario vuelve a estar activo y, si había perdido su hotel, este pasa a ser el activo.
  const profileUpdate = profile?.hotel_id
    ? { active: true }
    : { active: true, hotel_id: hotelId, role: changes.role };
  const { error } = await admin.from("profiles").update(profileUpdate).eq("id", userId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true };
}

export async function resolveManagedUserAccess(actorProfile: Profile, userId: string) {
  const hotelResult = await resolveManagedHotelId(actorProfile);
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
  const hotelResult = await resolveManagedHotelId(actorProfile);
  if (!hotelResult.ok) {
    return {
      ok: false as const,
      error: hotelResult.error,
      status: hotelResult.status,
    };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("list_hotel_users_with_meta", {
    p_hotel_id: hotelResult.hotelId,
  });

  if (error) {
    return {
      ok: false as const,
      error: error.message,
      status: 500,
    };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const filtered =
    actorProfile.role === "superadmin"
      ? rows
      : rows.filter((row) => String(row.role ?? "").trim().toLowerCase() !== "superadmin");

  const users: ManagedUserRow[] = filtered.map((row) => ({
    id: String(row.id),
    hotel_id: (row.hotel_id as string | null) ?? null,
    role: normalizeRole(row.role),
    active: (row.active as boolean) ?? true,
    full_name: (row.full_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    last_sign_in_at: (row.last_sign_in_at as string | null) ?? null,
    email_confirmed_at: (row.email_confirmed_at as string | null) ?? null,
    invited_at: (row.invited_at as string | null) ?? null,
    areas: Array.isArray(row.areas) ? (row.areas as { id: string; name: string }[]) : [],
    audit_run_count: Number(row.audit_run_count ?? 0),
  }));

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
    send_welcome_email?: unknown;
  }
) {
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password =
    typeof payload.password === "string" && payload.password.trim().length > 0
      ? payload.password.trim()
      : null;
  const fullName =
    typeof payload.full_name === "string" ? payload.full_name.trim() || null : null;

  if (!email) {
    return {
      ok: false as const,
      error: "El email es obligatorio.",
      status: 400,
    };
  }

  if (password !== null && password.length < 8) {
    return {
      ok: false as const,
      error: "La contraseña debe tener al menos 8 caracteres.",
      status: 400,
    };
  }

  const hotelResult = await resolveManagedHotelId(actorProfile);
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
  const createParams: Parameters<typeof admin.auth.admin.createUser>[0] = {
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: roleResult.role,
      hotel_id: hotelResult.hotelId,
      active: true,
    },
  };
  if (password) createParams.password = password;

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser(createParams);

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
      invited_at: new Date().toISOString(),
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
  const sendEmail = payload.send_welcome_email === true;
  void (async () => {
    if (!sendEmail) return;
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://servicecontrol.io";
      const [{ data: hotel }, enabled] = await Promise.all([
        admin.from("hotels").select("name").eq("id", hotelResult.hotelId).single(),
        shouldSendNotification(hotelResult.hotelId, "new_user_email"),
      ]);

      if (!enabled) return;

      // If no password was set, generate an activation link so the user sets their own password.
      let activationUrl: string | null = null;
      if (!password) {
        const { data: linkData } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${appUrl}/reset-password` },
        });
        activationUrl = buildRecoveryActivationLink(linkData, appUrl);
      }

      await sendWelcomeEmail({
        to: email,
        userName: fullName,
        hotelName: hotel?.name ?? "Su hotel",
        loginUrl: `${appUrl}/login`,
        activationUrl,
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
  const hotelId = targetScope.hotelId;

  // Usuario con acceso a otros hoteles: se quita sólo de este hotel.
  const membership = await findHotelMembership(targetUserId, hotelId);
  if (membership && (await countOtherMemberships(targetUserId, hotelId)) > 0) {
    const { error: unlinkErr } = await admin
      .from("hotel_memberships")
      .delete()
      .eq("user_id", targetUserId)
      .eq("hotel_id", hotelId);
    if (unlinkErr) {
      return { ok: false as const, error: unlinkErr.message, status: 500 };
    }
    return { ok: true as const, scope: "membership" as const };
  }

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (delAuthErr) {
    return {
      ok: false as const,
      error: delAuthErr.message ?? "No se pudo borrar el usuario de Auth.",
      status: 400,
    };
  }

  return { ok: true as const, scope: "user" as const };
}

// Añade a un usuario que ya existe a tu hotel con un rol. No crea cuentas.
export async function addExistingUserToHotel(
  actorProfile: Profile,
  payload: { email?: unknown; role?: unknown }
) {
  const hotelResult = await resolveManagedHotelId(actorProfile);
  if (!hotelResult.ok) {
    return { ok: false as const, error: hotelResult.error, status: hotelResult.status };
  }
  const hotelId = hotelResult.hotelId;

  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false as const, error: "El email es obligatorio.", status: 400 };

  const roleResult = assertRoleAssignable(actorProfile.role, payload.role);
  if (!roleResult.ok) return { ok: false as const, error: roleResult.error, status: roleResult.status };

  const admin = supabaseAdmin();
  // Escapa los comodines de ILIKE para que el email se compare literal.
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role, hotel_id, full_name, email")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (targetErr) return { ok: false as const, error: targetErr.message, status: 500 };
  if (!target) {
    return {
      ok: false as const,
      error: "No existe ningún usuario con ese email. Créalo primero desde «Crear usuario».",
      status: 404,
    };
  }
  if (normalizeRole(target.role) === "superadmin") {
    return { ok: false as const, error: "No se puede añadir un superadmin a un hotel.", status: 403 };
  }

  const existing = await findHotelMembership(target.id, hotelId);
  if (existing) {
    return { ok: false as const, error: "Ese usuario ya pertenece a este hotel.", status: 409 };
  }

  const userCheck = await canAddUser(hotelId);
  if (!userCheck.allowed) return { ok: false as const, error: userCheck.reason, status: 403 };

  const { error: insertErr } = await admin
    .from("hotel_memberships")
    .insert({ user_id: target.id, hotel_id: hotelId, role: roleResult.role, active: true });
  if (insertErr) return { ok: false as const, error: insertErr.message, status: 500 };

  // Si el usuario no tenía hotel activo, este pasa a serlo.
  if (!target.hotel_id) {
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ hotel_id: hotelId, role: roleResult.role })
      .eq("id", target.id);
    if (profileErr) return { ok: false as const, error: profileErr.message, status: 500 };
  }

  return {
    ok: true as const,
    user: {
      id: target.id,
      full_name: target.full_name ?? null,
      email: target.email ?? email,
      role: roleResult.role,
    },
  };
}
