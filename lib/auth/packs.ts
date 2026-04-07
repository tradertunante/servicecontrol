import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PackCode = "base" | "pack1" | "pack2" | "pack3";

export const PACK_LABELS: Record<PackCode, string> = {
  base: "Pack Base",
  pack1: "Pack 1",
  pack2: "Pack 2",
  pack3: "Pack 3",
};

export const PACK_DESCRIPTIONS: Record<PackCode, string> = {
  base: "General, Progreso, Historial, Members",
  pack1: "Recuperación, IT, Engineering",
  pack2: "Analisis",
  pack3: "Formaciones",
};

export const ALL_PACKS: PackCode[] = ["base", "pack1", "pack2", "pack3"];

export async function getHotelEnabledPacks(hotelId: string): Promise<PackCode[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("hotels")
    .select("enabled_packs")
    .eq("id", hotelId)
    .maybeSingle();

  if (error || !data) return ["base"];
  const raw = (data as { enabled_packs?: unknown }).enabled_packs;
  if (!Array.isArray(raw)) return ["base"];
  return raw as PackCode[];
}

export function hotelHasPack(enabledPacks: PackCode[], pack: PackCode): boolean {
  if (pack === "base") return true;
  return enabledPacks.includes(pack);
}
