"use client";

import type { CSSProperties } from "react";
import type { MyPeriodKey, MyProfile } from "../_hooks/useMyDashboardData";

function buildShellCard(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 16,
    background: "var(--header-bg)",
    boxShadow: "var(--header-shadow)",
    width: "100%",
  };
}

function buildInputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    outline: "none",
  };
}

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid var(--input-border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(0, 0, 0, 0.04)",
    cursor: "pointer",
    color: "var(--text)",
  };
}

function buildPillStyle(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(0, 0, 0, 0.03)",
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: "nowrap",
  };
}

export default function MyHeader({
  profile,
  hotelName,
  selectedPeriod,
  onChangePeriod,
  onAudit,
}: {
  profile: MyProfile | null;
  hotelName: string | null;
  selectedPeriod: MyPeriodKey;
  onChangePeriod: (value: MyPeriodKey) => void;
  onAudit: () => void;
}) {
  const shellCard = buildShellCard();
  const input = buildInputStyle();
  const btn = buildBtnStyle();

  return (
    <div style={{ ...shellCard, marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Mi espacio</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Tu ventana personal: trabajo, rendimiento y cuenta.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={buildPillStyle()}>
            <b>Usuario:</b> {profile?.full_name ?? "—"}
          </div>
          <div style={buildPillStyle()}>
            <b>Rol:</b> {profile?.role ?? "—"}
          </div>
          <div style={buildPillStyle()}>
            <b>Hotel:</b> {hotelName ?? "—"}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 220 }}>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Periodo</div>
          <select
            style={input}
            value={selectedPeriod}
            onChange={(e) => onChangePeriod(e.target.value as MyPeriodKey)}
          >
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>

        <button style={btn} onClick={onAudit}>
          Auditar
        </button>
      </div>
    </div>
  );
}