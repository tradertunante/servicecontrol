"use client";

import { useMemo } from "react";
import type { AuditRunRow } from "../_lib/dashboardTypes";
import {
  getMonthScore,
  getQuarterScore,
  getYearScore,
  getCurrentQuarter,
} from "../_lib/dashboardUtils";

export function useDashboardScores(runs: AuditRunRow[]) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const thisQuarter = getCurrentQuarter();

  const monthScore = useMemo(() => getMonthScore(runs, thisYear, thisMonth), [runs, thisYear, thisMonth]);
  const quarterScore = useMemo(() => getQuarterScore(runs, thisYear, thisQuarter), [runs, thisYear, thisQuarter]);
  const yearScore = useMemo(() => getYearScore(runs, thisYear), [runs, thisYear]);

  const prevMonthScore = useMemo(() => getMonthScore(runs, thisYear - 1, thisMonth), [runs, thisYear, thisMonth]);
  const prevQuarterScore = useMemo(() => getQuarterScore(runs, thisYear - 1, thisQuarter), [runs, thisYear, thisQuarter]);
  const prevYearScore = useMemo(() => getYearScore(runs, thisYear - 1), [runs, thisYear]);

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const r of runs) {
      if (!r.executed_at) continue;
      ys.add(new Date(r.executed_at).getFullYear());
    }
    if (ys.size === 0) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [runs]);

  return {
    monthScore, quarterScore, yearScore,
    prevMonthScore, prevQuarterScore, prevYearScore,
    availableYears,
  };
}
