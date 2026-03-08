// FILE: app/(app)/team/_components/reaudits/ReauditAssignmentSection.tsx
"use client";

import { fmtDate } from "../../_lib/reauditUtils";
import type {
  ProfileLite,
  ReassignReason,
  ReassignmentInfo,
} from "../../_lib/reauditTypes";

export default function ReauditAssignmentSection({
  assignedAuditorName,
  assignedAuditorId,
  canReassign,
  busy,
  auditorOptions,
  selectedAuditorId,
  selectedReason,
  selectedNote,
  onAuditorChange,
  onReasonChange,
  onNoteChange,
  onSave,
  onReset,
  reassignInfo,
}: {
  assignedAuditorName: string | null;
  assignedAuditorId: string | null;
  canReassign: boolean;
  busy: boolean;
  auditorOptions: ProfileLite[];
  selectedAuditorId: string;
  selectedReason: ReassignReason;
  selectedNote: string;
  onAuditorChange: (value: string) => void;
  onReasonChange: (value: ReassignReason) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
  reassignInfo: ReassignmentInfo | null;
}) {
  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    fontWeight: 900,
    cursor: "pointer",
  };

  const hasPendingChange =
    !!selectedAuditorId && selectedAuditorId !== (assignedAuditorId ?? "");

  return (
    <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
        Auditor asignado
      </div>

      <div style={{ fontWeight: 800 }}>{assignedAuditorName ?? "—"}</div>

      {canReassign ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            marginTop: 4,
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <select
            value={selectedAuditorId}
            onChange={(e) => onAuditorChange(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
            }}
          >
            <option value="">Selecciona auditor</option>
            {auditorOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.full_name ?? opt.id}
              </option>
            ))}
          </select>

          <select
            value={selectedReason}
            onChange={(e) => onReasonChange(e.target.value as ReassignReason)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
            }}
          >
            <option value="workload">workload</option>
            <option value="schedule">schedule</option>
            <option value="absence">absence</option>
            <option value="objectivity">objectivity</option>
            <option value="other">other</option>
          </select>

          <textarea
            value={selectedNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Nota opcional sobre la reasignación..."
            rows={2}
            style={{
              width: "100%",
              resize: "vertical",
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
            }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
      ) : null}

      {reassignInfo?.newAuditorName ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
            Última reasignación
          </div>

          <div style={{ marginTop: 6 }}>
            {reassignInfo.previousAuditorName || "—"} → {reassignInfo.newAuditorName}
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            Motivo: {reassignInfo.reason || "other"}
          </div>

          {reassignInfo.note ? (
            <div
              style={{
                marginTop: 6,
                whiteSpace: "pre-wrap",
                fontSize: 13,
              }}
            >
              {reassignInfo.note}
            </div>
          ) : null}

          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            {reassignInfo.changedBy ? `Por: ${reassignInfo.changedBy}` : ""}
            {reassignInfo.changedBy && reassignInfo.changedAt ? " · " : ""}
            {reassignInfo.changedAt ? `Fecha: ${fmtDate(reassignInfo.changedAt)}` : ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}