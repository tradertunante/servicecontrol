"use client";

import type { CSSProperties } from "react";
import type { MemberRecord } from "../_lib/memberTypes";

function secondaryButtonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    background: disabled ? "#f9fafb" : "#fff",
    color: "#111827",
    padding: "8px 10px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export default function MembersTable({
  members,
  busyMemberId,
  onEdit,
  onDelete,
}: {
  members: MemberRecord[];
  busyMemberId: string | null;
  onEdit: (member: MemberRecord) => void;
  onDelete: (member: MemberRecord) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        padding: 16,
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800 }}>Miembros</div>
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {members.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No hay miembros visibles para tu alcance actual.</div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 12,
                background: member.active ? "#fff" : "#f9fafb",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 800 }}>{member.full_name}</div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>
                    No. colaborador: <b>{member.employee_number || "—"}</b>
                  </div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>
                    Estado: <b>{member.active ? "Activo" : "Inactivo"}</b>
                  </div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>
                    Areas: {member.area_names.length ? member.area_names.join(", ") : "Sin areas"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onEdit(member)}
                    disabled={busyMemberId === member.id}
                    style={secondaryButtonStyle(busyMemberId === member.id)}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(member)}
                    disabled={busyMemberId === member.id}
                    style={secondaryButtonStyle(busyMemberId === member.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
