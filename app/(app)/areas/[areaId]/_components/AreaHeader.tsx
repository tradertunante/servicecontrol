// FILE: app/(app)/areas/[areaId]/_components/AreaHeader.tsx
"use client";

import type { Area, Role } from "../_lib/areaTypes";

export default function AreaHeader({
  area,
  role,
}: {
  area: Area | null;
  role: Role | null;
}) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          lineHeight: 1.25,
        }}
      >
        <span>
          {area?.name ?? "—"}
          {area?.type ? ` · ${area.type}` : ""}
        </span>
        <span style={{ opacity: 0.55 }}>·</span>
        <span style={{ opacity: 0.8, fontSize: 13 }}>
          Rol: <strong>{role ?? "—"}</strong>
        </span>
      </div>
    </div>
  );
}
