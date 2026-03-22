// FILE: app/(app)/team/_components/target-assignments/FilterBar.tsx
"use client";

import type { CSSProperties } from "react";
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
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Área</div>
          <select
            style={select}
            value={selectedAreaId}
            onChange={(e) => onAreaChange(e.target.value)}
          >
            <option value="">
              {areas.length ? "Selecciona un área…" : "No tienes áreas asignadas"}
            </option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo</div>
          <select
            style={select}
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value as PeriodKey)}
          >
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Objetivo total</div>
          <div style={input}>{selectedAreaId ? overallSummary.totalTarget : "—"}</div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Asignado</div>
          <div style={input}>{selectedAreaId ? overallSummary.totalAssigned : "—"}</div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Pendiente</div>
          <div style={input}>{selectedAreaId ? overallSummary.remaining : "—"}</div>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Estado</div>
          <div style={input}>{selectedAreaId ? overallSummary.status : "—"}</div>
        </div>
      </div>
    </div>
  );
}
