import { describe, it, expect } from "vitest";
import {
  getMonthScore,
  getQuarterScore,
  getYearScore,
  getCurrentQuarter,
  scoreColor,
  buildMonthLabelsForYear,
  buildMonthSlots,
} from "@/app/(app)/dashboard/_lib/dashboardUtils";
import type { AuditRunRow } from "@/app/(app)/dashboard/_lib/dashboardTypes";

function makeRun(overrides: Partial<AuditRunRow> = {}): AuditRunRow {
  return {
    id: "r1",
    status: "submitted",
    score: 80,
    executed_at: "2026-03-15T10:00:00Z",
    area_id: "a1",
    audit_template_id: "t1",
    ...overrides,
  };
}

describe("getMonthScore", () => {
  it("returns null avg for empty runs", () => {
    expect(getMonthScore([], 2026, 2)).toEqual({ avg: null, count: 0 });
  });

  it("calculates average for matching month", () => {
    const runs = [
      makeRun({ score: 80, executed_at: "2026-03-10T00:00:00Z" }),
      makeRun({ score: 60, executed_at: "2026-03-20T00:00:00Z" }),
    ];
    const result = getMonthScore(runs, 2026, 2); // March = month index 2
    expect(result.avg).toBe(70);
    expect(result.count).toBe(2);
  });

  it("ignores runs from other months", () => {
    const runs = [
      makeRun({ score: 90, executed_at: "2026-03-10T00:00:00Z" }),
      makeRun({ score: 50, executed_at: "2026-04-10T00:00:00Z" }),
    ];
    const result = getMonthScore(runs, 2026, 2);
    expect(result.avg).toBe(90);
    expect(result.count).toBe(1);
  });

  it("ignores runs with null executed_at", () => {
    const runs = [
      makeRun({ score: 80, executed_at: "2026-03-10T12:00:00Z" }),
      makeRun({ score: 70, executed_at: null }),
    ];
    const result = getMonthScore(runs, 2026, 2);
    expect(result.avg).toBe(80);
    expect(result.count).toBe(1);
  });

  it("treats null score as 0 (Number(null) === 0)", () => {
    const runs = [
      makeRun({ score: null, executed_at: "2026-03-10T12:00:00Z" }),
    ];
    const result = getMonthScore(runs, 2026, 2);
    expect(result.avg).toBe(0);
    expect(result.count).toBe(1);
  });

  it("filters out scores > 100 or < 0", () => {
    const runs = [
      makeRun({ score: 80, executed_at: "2026-03-10T00:00:00Z" }),
      makeRun({ score: 150, executed_at: "2026-03-11T00:00:00Z" }),
      makeRun({ score: -10, executed_at: "2026-03-12T00:00:00Z" }),
    ];
    const result = getMonthScore(runs, 2026, 2);
    expect(result.avg).toBe(80);
    expect(result.count).toBe(1);
  });
});

describe("getQuarterScore", () => {
  it("Q1 covers Jan-Mar", () => {
    const runs = [
      makeRun({ score: 90, executed_at: "2026-01-15T00:00:00Z" }),
      makeRun({ score: 70, executed_at: "2026-03-15T00:00:00Z" }),
      makeRun({ score: 50, executed_at: "2026-04-15T00:00:00Z" }), // Q2
    ];
    const result = getQuarterScore(runs, 2026, 1);
    expect(result.avg).toBe(80);
    expect(result.count).toBe(2);
  });

  it("Q4 covers Oct-Dec", () => {
    const runs = [
      makeRun({ score: 100, executed_at: "2026-10-15T12:00:00Z" }),
      makeRun({ score: 80, executed_at: "2026-12-15T12:00:00Z" }),
    ];
    const result = getQuarterScore(runs, 2026, 4);
    expect(result.avg).toBe(90);
    expect(result.count).toBe(2);
  });
});

describe("getYearScore", () => {
  it("averages all runs in year", () => {
    const runs = [
      makeRun({ score: 90, executed_at: "2026-01-10T00:00:00Z" }),
      makeRun({ score: 70, executed_at: "2026-06-10T00:00:00Z" }),
      makeRun({ score: 80, executed_at: "2025-12-10T00:00:00Z" }), // different year
    ];
    const result = getYearScore(runs, 2026);
    expect(result.avg).toBe(80);
    expect(result.count).toBe(2);
  });
});

describe("getCurrentQuarter", () => {
  it("returns a number between 1 and 4", () => {
    const q = getCurrentQuarter();
    expect(q).toBeGreaterThanOrEqual(1);
    expect(q).toBeLessThanOrEqual(4);
  });
});

describe("scoreColor", () => {
  it("returns danger for < 60", () => {
    expect(scoreColor(59)).toBe("var(--danger)");
  });
  it("returns warn for 60-79", () => {
    expect(scoreColor(60)).toBe("var(--warn)");
    expect(scoreColor(79)).toBe("var(--warn)");
  });
  it("returns ok for >= 80", () => {
    expect(scoreColor(80)).toBe("var(--ok)");
    expect(scoreColor(100)).toBe("var(--ok)");
  });
});

describe("buildMonthLabelsForYear", () => {
  it("returns 13 labels (12 months + Media)", () => {
    const labels = buildMonthLabelsForYear();
    expect(labels).toHaveLength(13);
    expect(labels[0]).toBe("Ene");
    expect(labels[11]).toBe("Dic");
    expect(labels[12]).toBe("Media");
  });
});

describe("buildMonthSlots", () => {
  it("YEAR mode returns 12 slots for the given year", () => {
    const slots = buildMonthSlots("YEAR", 2026);
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({ year: 2026, month: 0 });
    expect(slots[11]).toEqual({ year: 2026, month: 11 });
  });

  it("ROLLING_12M mode returns 12 slots", () => {
    const slots = buildMonthSlots("ROLLING_12M", 2026);
    expect(slots).toHaveLength(12);
  });
});
