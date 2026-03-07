"use client";

import type { CSSProperties } from "react";
import type { MyViewMode } from "../_hooks/useMyView";

function buildSubnavStyle(): CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    background: "var(--card-bg)",
    boxShadow: "var(--header-shadow)",
    width: "100%",
  };
}

function buildNavItemStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? "var(--muted)" : "var(--border)"}`,
    borderRadius: 12,
    padding: "10px 14px",
    background: active ? "rgba(46, 58, 193, 0.08)" : "var(--row-bg)",
    cursor: "pointer",
    fontWeight: active ? 800 : 650,
    opacity: active ? 1 : 0.92,
    whiteSpace: "nowrap",
    color: "var(--text)",
  };
}

const NAV_ITEMS: { key: MyViewMode; label: string }[] = [
  { key: "summary", label: "Resumen" },
  { key: "plan", label: "Mi plan" },
  { key: "performance", label: "Rendimiento" },
  { key: "account", label: "Mi cuenta" },
];

export default function MySubnav({
  viewMode,
  onChange,
}: {
  viewMode: MyViewMode;
  onChange: (value: MyViewMode) => void;
}) {
  const subnav = buildSubnavStyle();

  return (
    <div style={{ ...subnav, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {NAV_ITEMS.map((it) => {
          const active = viewMode === it.key;
          return (
            <button
              key={it.key}
              style={buildNavItemStyle(active)}
              onClick={() => onChange(it.key)}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}