// FILE: app/(app)/areas/[areaId]/_lib/areaUtils.ts
import type { PeriodKey, Role } from "./areaTypes";

export function canDeleteAudits(role: Role | null | undefined) {
  return role === "manager" || role === "admin" || role === "superadmin";
}

export function safePeriod(v: string | null): PeriodKey {
  if (v === "THIS_MONTH" || v === "LAST_3_MONTHS" || v === "THIS_YEAR") return v;
  return "THIS_MONTH";
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function scoreColor(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "#000";
  if (score < 60) return "#c62828";
  if (score < 80) return "#ef6c00";
  return "#000";
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function monthLabel(monthIndex: number) {
  const d = new Date(2020, monthIndex, 1);
  const s = d.toLocaleDateString("es-ES", { month: "long" }).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthStartEndISO(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0); // exclusive
  return { start: start.toISOString(), end: end.toISOString() };
}

export function periodLabel(p: PeriodKey) {
  if (p === "THIS_MONTH") return "Este mes";
  if (p === "LAST_3_MONTHS") return "3 últimos meses";
  return "Año";
}

export function getPeriodRange(now: Date, p: PeriodKey) {
  const end = new Date(now);

  let start: Date;
  if (p === "THIS_MONTH") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (p === "LAST_3_MONTHS") {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  }

  return { startMs: start.getTime(), endMs: end.getTime() };
}