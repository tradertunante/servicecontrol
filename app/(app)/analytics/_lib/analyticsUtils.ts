import type { Role } from "./analyticsTypes";

export const HOTEL_KEY = "sc_hotel_id";

export function canSeeAnalytics(role: Role) {
  return role === "admin" || role === "manager" || role === "superadmin";
}

export function isAdminLike(role: Role) {
  return role === "admin" || role === "superadmin";
}

export function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function safeVal(v: any): "PASS" | "FAIL" | "NA" | null {
  if (v === "PASS" || v === "FAIL" || v === "NA") return v;
  return null;
}

export function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100 * 100) / 100;
}

export function periodLabel(period: string) {
  if (period === "30") return "Últimos 30 días";
  if (period === "60") return "Últimos 60 días";
  if (period === "90") return "Últimos 90 días";
  if (period === "365") return "Últimos 12 meses";
  return "Personalizado";
}

export function areaLabel(name?: string | null, type?: string | null) {
  if (!name) return "—";
  return type ? `${name} · ${type}` : name;
}