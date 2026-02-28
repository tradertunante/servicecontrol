// FILE: app/(app)/dashboard/_lib/dashboardUtils.ts
import type { AuditRunRow, ScoreAgg, TrendPoint } from "./dashboardTypes";

export type HeatMode = "ROLLING_12M" | "YEAR";

export function getMonthScore(runs: AuditRunRow[], year: number, month: number): ScoreAgg {
  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => {
      const d = new Date(r.executed_at!);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

export function getQuarterScore(runs: AuditRunRow[], year: number, quarter: number): ScoreAgg {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;

  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => {
      const d = new Date(r.executed_at!);
      const m = d.getMonth();
      return d.getFullYear() === year && m >= startMonth && m <= endMonth;
    })
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

export function getYearScore(runs: AuditRunRow[], year: number): ScoreAgg {
  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => new Date(r.executed_at!).getFullYear() === year)
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

export function getMonthScoreForTemplate(
  runs: AuditRunRow[],
  templateId: string,
  year: number,
  month: number
): ScoreAgg {
  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => r.audit_template_id === templateId)
    .filter((r) => {
      const d = new Date(r.executed_at!);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

export function getYearScoreForTemplate(runs: AuditRunRow[], templateId: string, year: number): ScoreAgg {
  const vals = runs
    .filter((r) => r.executed_at)
    .filter((r) => r.audit_template_id === templateId)
    .filter((r) => new Date(r.executed_at!).getFullYear() === year)
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

export function getCurrentQuarter(): number {
  const month = new Date().getMonth();
  return Math.floor(month / 3) + 1;
}

// ✅ colores basados SOLO en Globals.css
export function scoreColor(score: number) {
  if (score < 60) return "var(--danger)";
  if (score < 80) return "var(--warn)";
  return "var(--ok)";
}

export function formatMonthKey(d: Date) {
  const s = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").slice(0, 3);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * ✅ Labels para ROLLING 12M: últimos 12 meses desde HOY (incluye mes actual),
 * y al final "Media"
 */
export function buildMonthLabelsRolling12M(): string[] {
  const labels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const s = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    labels.push(s.charAt(0).toUpperCase() + s.slice(1, 3));
  }
  labels.push("Media");
  return labels;
}

/**
 * ✅ Labels para YEAR: Ene..Dic + "Media"
 */
export function buildMonthLabelsForYear(): string[] {
  const base = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return [...base, "Media"];
}

/**
 * ✅ Devuelve el rango de meses (year, monthIndex) para pintar columnas.
 * - ROLLING_12M: 12 meses relativos a hoy
 * - YEAR: 12 meses del año seleccionado (ene..dic)
 */
export function buildMonthSlots(mode: HeatMode, selectedYear: number): Array<{ year: number; month: number }> {
  if (mode === "YEAR") {
    return Array.from({ length: 12 }, (_, m) => ({ year: selectedYear, month: m }));
  }

  // rolling
  const slots: Array<{ year: number; month: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    slots.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return slots;
}

/**
 * ✅ Media rolling 12M: promedio de las columnas rolling.
 */
export function getRolling12MScore(runs: AuditRunRow[]): ScoreAgg {
  const slots = buildMonthSlots("ROLLING_12M", new Date().getFullYear());
  const vals: number[] = [];

  for (const s of slots) {
    const ms = getMonthScore(runs, s.year, s.month);
    if (ms.avg != null) vals.push(ms.avg);
  }

  if (vals.length === 0) return { avg: null, count: 0 };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { avg: Math.round(avg * 100) / 100, count: vals.length };
}

/**
 * ✅ Media anual: promedio del año seleccionado.
 * (ojo: esto promedia a nivel de run, no por mes)
 */
export function getYearAverage(runs: AuditRunRow[], year: number): ScoreAgg {
  return getYearScore(runs, year);
}

export function build3MonthTrendFromRuns(runs: AuditRunRow[], areaId: string): TrendPoint[] {
  const areaRuns = runs.filter((r) => r.area_id === areaId);
  const points: TrendPoint[] = [];

  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const s = getMonthScore(areaRuns, year, monthIndex);

    points.push({
      key: formatMonthKey(d),
      monthIndex,
      year,
      avg: s.avg,
      count: s.count,
    });
  }

  return points;
}