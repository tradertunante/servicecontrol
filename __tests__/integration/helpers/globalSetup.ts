// Sweep global: borra restos de ejecuciones anteriores que hayan crasheado
// antes de su cleanup(). Solo toca entidades con el prefijo/dominio reservado
// de tests, nunca datos reales.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { purgeHotel, deleteTemplateTrees } from "./purge";

const STALE_AFTER_MS = 60 * 60 * 1000; // 1h: no pisar una ejecución en paralelo reciente

export default async function globalSetup(): Promise<void> {
  if (process.env.RUN_SUPABASE_INTEGRATION !== "1") return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  try {
    // Usuarios de test huérfanos (el trigger de cleanup borra sus profiles).
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of data?.users ?? []) {
      const isTestUser = user.email?.endsWith("@sc-integration-tests.dev");
      if (isTestUser && user.created_at < cutoff) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }

    // Hoteles de test huérfanos y su árbol de dependencias.
    const { data: hotels } = await admin
      .from("hotels")
      .select("id, created_at")
      .like("name", "[IT][%")
      .lt("created_at", cutoff);

    for (const hotel of hotels ?? []) {
      const errors = await purgeHotel(admin, hotel.id);
      if (errors.length > 0) {
        console.warn(`[integration] sweep: hotel ${hotel.id} no purgado del todo:`, errors);
      }
    }

    // Packs y plantillas globales de test huérfanos.
    const { data: packs } = await admin
      .from("global_audit_packs")
      .select("id")
      .like("name", "[IT][%")
      .lt("created_at", cutoff);
    for (const pack of packs ?? []) {
      await admin.from("global_audit_pack_templates").delete().eq("pack_id", pack.id);
      await admin.from("global_audit_packs").delete().eq("id", pack.id);
    }
    const { data: globalTpls } = await admin
      .from("audit_templates")
      .select("id")
      .is("hotel_id", null)
      .like("name", "[IT][%");
    await deleteTemplateTrees(admin, (globalTpls ?? []).map((t) => t.id));

    await admin.from("trial_leads").delete().like("email", "%@sc-integration-tests.dev");
  } catch (err) {
    console.warn("[integration] sweep de limpieza falló (continuamos):", err);
  }
}