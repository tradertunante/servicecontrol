"use client";

import type { CSSProperties } from "react";
import type { MyPeriodKey, MyProfile } from "../_hooks/useMyDashboardData";

function buildShellCard(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
    background: "var(--header-bg)",
    boxShadow: "var(--header-shadow)",
    width: "100%",
  };
}

function buildInputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    outline: "none",
  };
}

function buildBtnStyle(): CSSProperties {
  return {
    border: "1px solid var(--input-border)",
    borderRadius: 10,
    padding: "9px 11px",
    background: "rgba(0, 0, 0, 0.04)",
    cursor: "pointer",
    color: "var(--text)",
  };
}

function buildPillStyle(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "5px 9px",
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
  onLogout,
  isLoggingOut,
}: {
  profile: MyProfile | null;
  hotelName: string | null;
  selectedPeriod: MyPeriodKey;
  onChangePeriod: (value: MyPeriodKey) => void;
  onAudit: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
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
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>Mi espacio</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Tu ventana personal: trabajo, rendimiento y cuenta.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
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
          marginTop: 10,
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 180, flex: "1 1 180px", maxWidth: 240 }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button style={btn} onClick={onAudit}>
            Auditar
          </button>

          <button style={btn} onClick={onLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
