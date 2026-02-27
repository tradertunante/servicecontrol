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
    <div style={{ opacity: 0.85, marginBottom: 18 }}>
      {area?.type ? `${area.type} · ` : ""}
      Rol: <strong>{role ?? "—"}</strong>
    </div>
  );
}