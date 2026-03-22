// FILE: app/(app)/team/_components/target-assignments/UserAssignmentRow.tsx
"use client";

import type { CSSProperties } from "react";
import type { AssignmentRow, TeamUserRow } from "./types";

type Props = {
  input: CSSProperties;
  user: TeamUserRow;
  managerId: string | null;
  templateId: string;
  row: AssignmentRow;
  onUpdate: (templateId: string, userId: string, value: number) => void;
};

export default function UserAssignmentRow({
  input,
  user,
  managerId,
  templateId,
  row,
  onUpdate,
}: Props) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
        display: "grid",
        gridTemplateColumns: "minmax(220px, 1fr) 180px",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontWeight: 750 }}>
          {user.full_name ?? user.id.slice(0, 8)}
        </div>
        <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
          Rol: <b>{user.role ?? "—"}</b>
          {user.id === managerId ? " · tú" : ""}
        </div>
      </div>

      <div>
        <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
          Objetivo asignado
        </div>
        <input
          style={input}
          type="number"
          min={0}
          step={1}
          value={row.target_count}
          onChange={(e) => onUpdate(templateId, user.id, Number(e.target.value))}
        />
      </div>
    </div>
  );
}
