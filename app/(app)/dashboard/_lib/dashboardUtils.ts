// FILE: app/(app)/dashboard/_lib/dashboardUtils.ts

import type { AuditRunRow, ScoreAgg, TrendPoint } from "./dashboardTypes";

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

export function scoreColor(score: number) {
  if (score < 60) return "var(--danger, #c62828)";
  if (score < 80) return "var(--warn, #ef6c00)";
  return "var(--ok, #0a7a3b)";
}

export function formatMonthKey(d: Date) {
  const s = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").slice(0, 3);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildMonthLabels12MPlusYear(): string[] {
  const labels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const s = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    labels.push(s.charAt(0).toUpperCase() + s.slice(1, 3));
  }
  labels.push("Año");
  return labels;
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