"use client";

import type { CSSProperties } from "react";
import type { MyProfile, RecentRunRow } from "../_hooks/useMyDashboardData";
import MySecurityCard from "./MySecurityCard";

function miniCard(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
    background: "var(--card-bg)",
    width: "100%",
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

function formatScore(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.replace("T", " ").slice(0, 16);
  return d.toLocaleString();
}

export default function MyAccountView({
  loading,
  isLoggingOut,
  profile,
  hotelName,
  areaNames,
  myRecentRuns,
  onLogout,
}: {
  loading: boolean;
  isLoggingOut: boolean;
  profile: MyProfile | null;
  hotelName: string | null;
  areaNames: string[];
  myRecentRuns: RecentRunRow[];
  onLogout: () => void;
}) {
  const card = miniCard();
  const btn = buildBtnStyle();

  const accountRows = [
    { label: "Nombre", value: profile?.full_name ?? "—" },
    { label: "Email", value: profile?.email ?? "—" },
    { label: "Rol", value: profile?.role ?? "—" },
    { label: "Hotel", value: hotelName ?? "—" },
    {
      label: "Áreas",
      value: areaNames.length > 0 ? areaNames.join(", ") : "Sin áreas asignadas",
    },
    { label: "Estado", value: profile?.active === false ? "Inactivo" : "Activo" },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {accountRows.map((row) => (
          <div key={row.label} style={card}>
            <div style={{ opacity: 0.75, fontSize: 12 }}>{row.label}</div>
            <div style={{ marginTop: 6, fontWeight: 800, lineHeight: 1.4 }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={btn} onClick={onLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
        </button>
      </div>

      <MySecurityCard email={profile?.email} />

      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Actividad reciente</div>
        <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>
          Últimas auditorías ejecutadas por ti.
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {loading ? (
            <div style={{ opacity: 0.85 }}>Cargando…</div>
          ) : myRecentRuns.length === 0 ? (
            <div style={{ opacity: 0.85 }}>Aún no hay actividad reciente.</div>
          ) : (
            myRecentRuns.slice(0, 8).map((run) => (
              <div
                key={run.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  background: "var(--row-bg)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>
                      {run.template_name ?? "Auditoría"}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                      {formatDateTime(run.executed_at)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800 }}>{formatScore(run.score)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
