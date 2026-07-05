import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logger } from "@/lib/logger";
import { getPlan } from "./plans";

export type ProvisionResult = {
  hotelId: string | null;
  created: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  hotel_id: string | null;
  is_trial: boolean | null;
  trial_hotel_name: string | null;
};

/**
 * Aprovisiona el acceso real de una cuenta que acaba de pagar.
 * Idempotente: Stripe puede reintentar el webhook.
 *
 * - Ex-trial (vive en el hotel demo compartido): crea su hotel con el nombre
 *   que dio al registrarse, activa los packs del plan, lo convierte en admin
 *   de ese hotel y le quita el flag de trial. Acceso inmediato tras el pago.
 * - Admin con hotel propio: asegura el vínculo hotel↔cuenta (sin robar hoteles
 *   de otra cuenta) y sincroniza los packs del plan.
 */
export async function provisionAccountAccess(params: {
  billingAccountId: string;
  ownerUserId: string;
  planCode: string;
}): Promise<ProvisionResult> {
  const { billingAccountId, ownerUserId, planCode } = params;
  const admin = supabaseAdmin();
  const plan = getPlan(planCode);
  const enabledPacks = plan?.enabledPacks ?? ["base", "pack2"];

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, role, hotel_id, is_trial, trial_hotel_name")
    .eq("id", ownerUserId)
    .maybeSingle();

  if (profileError || !profileData) {
    throw new Error(`provisioning: perfil no encontrado para ${ownerUserId}`);
  }
  const profile = profileData as ProfileRow;

  const demoHotelId = process.env.TRIAL_DEMO_HOTEL_ID ?? null;
  const ownerNeedsRescue =
    profile.is_trial === true || !profile.hotel_id || profile.hotel_id === demoHotelId;

  // Idempotencia: si la cuenta ya tiene hotel, solo asegurar estado.
  const { data: ownedHotel } = await admin
    .from("hotels")
    .select("id")
    .eq("billing_account_id", billingAccountId)
    .limit(1)
    .maybeSingle();

  if (ownedHotel?.id) {
    const hotelId = String(ownedHotel.id);
    await admin.from("hotels").update({ enabled_packs: enabledPacks }).eq("id", hotelId);
    if (ownerNeedsRescue) await ensureOwnerOnHotel(profile, hotelId);
    return { hotelId, created: false };
  }

  const hasOwnHotel = !ownerNeedsRescue;

  if (hasOwnHotel) {
    // Admin existente: vincular su hotel si está libre; nunca robar el de otra cuenta.
    const hotelId = String(profile.hotel_id);
    const { data: hotel } = await admin
      .from("hotels")
      .select("billing_account_id")
      .eq("id", hotelId)
      .maybeSingle();

    if (!hotel?.billing_account_id) {
      await admin
        .from("hotels")
        .update({ billing_account_id: billingAccountId, enabled_packs: enabledPacks })
        .eq("id", hotelId)
        .is("billing_account_id", null);
      logger.info("provisioning_hotel_linked", { hotelId, billingAccountId, planCode });
      return { hotelId, created: false };
    }

    if (hotel.billing_account_id === billingAccountId) {
      await admin.from("hotels").update({ enabled_packs: enabledPacks }).eq("id", hotelId);
      return { hotelId, created: false };
    }

    logger.warn("provisioning_hotel_owned_by_other_account", { hotelId, billingAccountId });
    return { hotelId: null, created: false };
  }

  // Ex-trial: crear su hotel real y moverlo desde el hotel demo.
  const hotelName =
    (profile.trial_hotel_name ?? "").trim() ||
    `Hotel de ${(profile.full_name ?? "").trim() || "cliente"}`;

  const { data: newHotel, error: hotelError } = await admin
    .from("hotels")
    .insert([{ name: hotelName, active: true, billing_account_id: billingAccountId, enabled_packs: enabledPacks }])
    .select("id")
    .single();

  if (hotelError || !newHotel?.id) {
    throw new Error(`provisioning: no se pudo crear el hotel (${hotelError?.message ?? "sin datos"})`);
  }
  const hotelId = String(newHotel.id);

  // Área por defecto, igual que el alta de hotel de superadmin.
  const { error: areaError } = await admin
    .from("areas")
    .insert({ hotel_id: hotelId, name: "Otros", type: "otros", active: true });
  if (areaError) {
    logger.warn("provisioning_default_area_failed", { hotelId, error: areaError.message });
  }

  await ensureOwnerOnHotel(profile, hotelId);

  logger.info("provisioning_hotel_created", { hotelId, hotelName, billingAccountId, ownerUserId, planCode });
  return { hotelId, created: true };
}

/** Deja al dueño de la cuenta como admin activo de su hotel, fuera del demo. */
async function ensureOwnerOnHotel(profile: ProfileRow, hotelId: string) {
  const admin = supabaseAdmin();
  const needsMove = profile.hotel_id !== hotelId || profile.role !== "admin" || profile.is_trial === true;
  if (!needsMove) return;

  const { error } = await admin
    .from("profiles")
    .update({ hotel_id: hotelId, role: "admin", is_trial: false })
    .eq("id", profile.id);

  if (error) {
    throw new Error(`provisioning: no se pudo actualizar el perfil ${profile.id} (${error.message})`);
  }

  // Metadatos de auth en sync (el trigger de perfiles solo corre en INSERT,
  // pero otros flujos leen role/hotel_id de user_metadata).
  await admin.auth.admin
    .updateUserById(profile.id, {
      user_metadata: { role: "admin", hotel_id: hotelId, is_trial: false, active: true },
    })
    .catch((err) => {
      logger.warn("provisioning_auth_metadata_sync_failed", {
        userId: profile.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
