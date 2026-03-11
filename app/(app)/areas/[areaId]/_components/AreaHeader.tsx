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
        padding: 12,
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: "var(--muted)" }}>
        Área activa
      </div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>
        {area?.name ?? "—"}
        {area?.type ? ` · ${area.type}` : ""}
      </div>
      <div style={{ marginTop: 4, opacity: 0.8, fontSize: 13 }}>
        Rol: <strong>{role ?? "—"}</strong>
      </div>
    </div>
  );
}
