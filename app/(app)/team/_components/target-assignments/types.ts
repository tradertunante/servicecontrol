// FILE: app/(app)/team/_components/target-assignments/types.ts

import type { CSSProperties } from "react";

export type PeriodKey = "daily" | "weekly" | "monthly";

export type AreaRow = {
  id: string;
  name: string;
};

export type TeamUserRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  hotel_id?: string | null;
  active?: boolean | null;
};

export type ViewerProfile = {
  id: string;
  role: string | null;
};

export type NameRelation = {
  name: string | null;
};

export type MaybeRelation = NameRelation | NameRelation[] | null;

export type AreaTemplateTargetRowRaw = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
  audit_templates?: MaybeRelation;
};

export type AreaTemplateTargetRow = {
  id: string;
  hotel_id: string;
  area_id: string;
  audit_template_id: string;
  period: string;
  target_count: number;
  active: boolean | null;
  audit_templates: NameRelation | null;
};

export type AssignmentRow = {
  id?: string;
  user_id: string;
  target_count: number;
  active: boolean;
  source_ids?: string[];
};

export type TemplateAssignmentMap = Record<string, Record<string, AssignmentRow>>;

export type FeedbackState = {
  type: "success" | "info";
  text: string;
} | null;

export type OverallSummary = {
  totalTarget: number;
  totalAssigned: number;
  remaining: number;
  status: string;
};

export type TemplateDirtyEntry = {
  dirty: boolean;
  changedRows: AssignmentRow[];
};

// ─── Style builders ──────────────────────────────────────────────────────────

export function buildBtn(): CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    cursor: "pointer",
    color: "white",
  };
}

export function buildInput(): CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "white",
    outline: "none",
  };
}

export function buildSelect(): CSSProperties {
  return buildInput();
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function getPeriodLabel(period: string) {
  if (period === "daily") return "diario";
  if (period === "weekly") return "semanal";
  if (period === "monthly") return "mensual";
  return period;
}

export function normalizeAssignmentValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function getAssignmentStatus(targetCount: number, assignedTotal: number, hasGoal: boolean) {
  if (!hasGoal) return "Sin objetivo";
  if (assignedTotal === 0) return "Pendiente";
  if (assignedTotal < targetCount) return "Parcial";
  if (assignedTotal === targetCount) return "Completo";
  return "Excedido";
}

export function buildEquitableDistribution(targetCount: number, memberCount: number) {
  if (memberCount <= 0) return [];

  const normalizedTarget = normalizeAssignmentValue(targetCount);
  const base = Math.floor(normalizedTarget / memberCount);
  const remainder = normalizedTarget % memberCount;

  return Array.from({ length: memberCount }, (_, index) =>
    base + (index < remainder ? 1 : 0)
  );
}

export function buildLoadBasedDistribution(targetCount: number, currentLoads: number[]) {
  const normalizedTarget = normalizeAssignmentValue(targetCount);
  if (currentLoads.length === 0) return [];

  const nextAssignments = Array.from({ length: currentLoads.length }, () => 0);

  for (let unit = 0; unit < normalizedTarget; unit += 1) {
    let selectedIndex = 0;
    let selectedLoad = currentLoads[0] + nextAssignments[0];

    for (let index = 1; index < currentLoads.length; index += 1) {
      const candidateLoad = currentLoads[index] + nextAssignments[index];
      if (candidateLoad < selectedLoad) {
        selectedIndex = index;
        selectedLoad = candidateLoad;
      }
    }

    nextAssignments[selectedIndex] += 1;
  }

  return nextAssignments;
}

export function normalizeRelation(value: MaybeRelation): NameRelation | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function getTemplateName(row: AreaTemplateTargetRow) {
  return row.audit_templates?.name ?? "Template sin nombre";
}
