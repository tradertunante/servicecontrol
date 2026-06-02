import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PackCode = "base" | "pack1" | "pack_it" | "pack_engineering" | "pack2" | "pack3";

export const PACK_LABELS: Record<PackCode, string> = {
  base: "Core",
  pack1: "Analítica",
  pack_it: "IT",
  pack_engineering: "Engineering",
  pack2: "Recuperación",
  pack3: "Formación",
};

export const PACK_DESCRIPTIONS: Record<PackCode, string> = {
  base: "Auditorías, recuperación, reauditorías, historial, members",
  pack1: "Dashboards avanzados, tendencias, exportes",
  pack_it: "Módulo departamental IT",
  pack_engineering: "Módulo departamental Engineering / Mantenimiento",
  pack2: "Incluido en Core",
  pack3: "Gestión de formaciones del equipo",
};

export const ALL_PACKS: PackCode[] = ["base", "pack1", "pack_it", "pack_engineering", "pack2", "pack3"];

// Packs activados en el hotel demo del sandbox — equivale al plan Operaciones
export const TRIAL_ENABLED_PACKS: PackCode[] = ["base", "pack1", "pack2", "pack3"];

export async function getHotelEnabledPacks(hotelId: string): Promise<PackCode[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("hotels")
    .select("enabled_packs")
    .eq("id", hotelId)
    .maybeSingle();

  if (error || !data) return ["base", "pack2"];
  const raw = (data as { enabled_packs?: unknown }).enabled_packs;
  if (!Array.isArray(raw)) return ["base", "pack2"];
  const packs = raw as PackCode[];
  // pack2 (recuperación) es parte del Core — siempre incluido
  if (!packs.includes("pack2")) return [...packs, "pack2"];
  return packs;
}

export function hotelHasPack(enabledPacks: PackCode[], pack: PackCode): boolean {
  if (pack === "base" || pack === "pack2") return true;
  return enabledPacks.includes(pack);
}
