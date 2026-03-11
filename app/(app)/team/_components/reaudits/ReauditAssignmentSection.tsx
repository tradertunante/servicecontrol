// FILE: app/(app)/team/_components/reaudits/ReauditAssignmentSection.tsx
"use client";

import type { ProfileLite } from "../../_lib/reauditTypes";

export default function ReauditAssignmentSection({
  assignedAuditorName,
  assignedAuditorId,
  canReassign,
  busy,
  auditorOptions,
  selectedAuditorId,
  selectedNote,
  onAuditorChange,
  onNoteChange,
  onSave,
  onReset,
}: {
  assignedAuditorName: string | null;
  assignedAuditorId: string | null;
  canReassign: boolean;
  busy: boolean;
  auditorOptions: ProfileLite[];
  selectedAuditorId: string;
  selectedNote: string;
  onAuditorChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onReset: () => void;
}) {
  const currentAuditorId = assignedAuditorId ?? "";
  const hasPendingChange =
    !!selectedAuditorId && selectedAuditorId !== currentAuditorId;

  const panelStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    padding: 9,
    display: "grid",
    gap: 6,
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--muted)",
    fontWeight: 800,
    lineHeight: 1.2,
  };

  const btn: React.CSSProperties = {
    padding: "7px 11px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    minHeight: 40,
  };

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={labelStyle}>Auditor asignado</div>
        <div
          style={{
            fontWeight: 800,
            overflowWrap: "anywhere",
            textAlign: "right",
          }}
        >
          {assignedAuditorName ?? "—"}
        </div>
      </div>

      {canReassign ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
            alignItems: "center",
          }}
        >
          <select
            value={selectedAuditorId}
            onChange={(e) => onAuditorChange(e.target.value)}
            style={{
              padding: "9px 11px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              minHeight: 40,
              width: "100%",
            }}
          >
            <option value="">Selecciona auditor</option>
            {auditorOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.full_name ?? opt.id}
              </option>
            ))}
          </select>

          {hasPendingChange ? (
            <input
              value={selectedNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Nota opcional..."
              style={{
                width: "100%",
                padding: "9px 11px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                minHeight: 40,
              }}
            />
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              disabled={busy || !hasPendingChange}
              onClick={onSave}
              style={{
                ...btn,
                background: "white",
                color: "black",
                opacity: busy || !hasPendingChange ? 0.5 : 1,
              }}
            >
              {busy ? "Guardando..." : "Guardar auditor"}
            </button>

            {hasPendingChange ? (
              <button disabled={busy} onClick={onReset} style={btn}>
                Reset
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.03)",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          No tienes permiso para reasignar el auditor o la re-auditoría ya fue cerrada.
        </div>
      )}
    </div>
  );
}
