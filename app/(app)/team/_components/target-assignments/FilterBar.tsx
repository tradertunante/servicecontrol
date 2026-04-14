// FILE: app/(app)/team/_components/target-assignments/FilterBar.tsx
"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AreaRow, OverallSummary, PeriodKey } from "./types";

type Props = {
  select: CSSProperties;
  input: CSSProperties;
  areas: AreaRow[];
  selectedAreaId: string;
  selectedPeriod: PeriodKey;
  overallSummary: OverallSummary;
  onAreaChange: (areaId: string) => void;
  onPeriodChange: (period: PeriodKey) => void;
};

export default function FilterBar({
  select,
  input,
  areas,
  selectedAreaId,
  selectedPeriod,
  overallSummary,
  onAreaChange,
  onPeriodChange,
}: Props) {
  const t = useTranslations("app.team.targets");
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.10)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>{t("fieldArea")}</div>
          <select
            style={select}
            value={selectedAreaId}
            onChange={(e) => onAreaChange(e.target.value)}
          >
            <option value="">
              {areas.length ? t("selectArea") : t("noAreas")}
            </option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>{t("fieldPeriod")}</div>
          <select
            style={select}
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value as PeriodKey)}
          >
            <option value="daily">{t("periodDaily")}</option>
            <option value="weekly">{t("periodWeekly")}</option>
            <option value="monthly">{t("periodMonthly")}</option>
          </select>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>{t("fieldTotalTarget")}</div>
          <div style={input}>{selectedAreaId ? overallSummary.totalTarget : "—"}</div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>{t("fieldAssigned")}</div>
          <div style={input}>{selectedAreaId ? overallSummary.totalAssigned : "—"}</div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>{t("fieldPending")}</div>
          <div style={input}>{selectedAreaId ? overallSummary.remaining : "—"}</div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>{t("fieldStatus")}</div>
          <div style={input}>{selectedAreaId ? overallSummary.status : "—"}</div>
        </div>
      </div>
    </div>
  );
}
