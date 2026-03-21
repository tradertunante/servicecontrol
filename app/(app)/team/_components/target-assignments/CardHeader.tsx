// FILE: app/(app)/team/_components/target-assignments/CardHeader.tsx
"use client";

import type { CSSProperties } from "react";

type Props = {
  btn: CSSProperties;
  loading: boolean;
  saving: boolean;
  selectedAreaId: string;
  onRefresh: () => void;
  onOpenHistory: () => void;
};

export default function CardHeader({
  btn,
  loading,
  saving,
  selectedAreaId,
  onRefresh,
  onOpenHistory,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          Reparto del objetivo por auditoría
        </div>
        <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
          Reparte el objetivo de cada template entre los auditores de tu equipo según
          el periodo seleccionado.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          style={btn}
          onClick={onRefresh}
          disabled={loading || saving}
        >
          Refrescar
        </button>
        <button style={btn} onClick={onOpenHistory} disabled={!selectedAreaId}>
          Historial
        </button>
      </div>
    </div>
  );
}
