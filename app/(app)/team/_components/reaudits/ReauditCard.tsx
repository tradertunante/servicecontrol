// FILE: app/(app)/team/_components/reaudits/ReauditCard.tsx
"use client";

import { useRouter } from "next/navigation";
import type {
  EnrichedReauditRow,
  ProfileLite,
  ReassignReason,
  ReassignmentInfo,
  TrainingInfo,
} from "../../_lib/reauditTypes";
import { dayDiffFromNow, fmtDate } from "../../_lib/reauditUtils";
import ReauditAssignmentSection from "./ReauditAssignmentSection";
import ReauditTrainingSection from "./ReauditTrainingSection";

export default function ReauditCard({
  row,
  busy,
  canManageReauditAssignment,
  auditorOptions,
  trainingValue,
  reassignAuditorValue,
  reassignReasonValue,
  reassignNoteValue,
  trainingInfo,
  reassignInfo,
  onTrainingOpen,
  onTrainingCancel,
  onTrainingChange,
  onTrainingSave,
  onReassignAuditorChange,
  onReassignReasonChange,
  onReassignNoteChange,
  onReassignSave,
  onReassignReset,
  isTrainingOpen,
}: {
  row: EnrichedReauditRow;
  busy: boolean;
  canManageReauditAssignment: boolean;
  auditorOptions: ProfileLite[];
  trainingValue: string;
  reassignAuditorValue: string;
  reassignReasonValue: ReassignReason;
  reassignNoteValue: string;
  trainingInfo: TrainingInfo | null;
  reassignInfo: ReassignmentInfo | null;
  onTrainingOpen: () => void;
  onTrainingCancel: () => void;
  onTrainingChange: (value: string) => void;
  onTrainingSave: () => void;
  onReassignAuditorChange: (value: string) => void;
  onReassignReasonChange: (value: ReassignReason) => void;
  onReassignNoteChange: (value: string) => void;
  onReassignSave: () => void;
  onReassignReset: () => void;
  isTrainingOpen: boolean;
}) {
  const router = useRouter();

  const btn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-bg)",
    fontWeight: 900,
    cursor: "pointer",
  };

  const primaryBtn: React.CSSProperties = {
    ...btn,
    background: "black",
    color: "white",
  };

  const daysToDue = dayDiffFromNow(row.scheduled_for);
  const isOverdue = daysToDue !== null && daysToDue < 0;
  const isReady = !!row.ready_for_reaudit;
  const canConfirmTraining =
    row.status === "pending_training" &&
    row.requires_training === true &&
    row.training_confirmed !== true;
  const canReassign = canManageReauditAssignment && !row.executed_at;

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: isReady ? "1px solid rgba(0,200,0,0.30)" : "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: "var(--shadow-sm)",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              padding: "5px 9px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background:
                row.status === "draft"
                  ? "rgba(0,200,0,0.10)"
                  : row.status === "pending_training"
                    ? "rgba(255,180,0,0.12)"
                    : "rgba(220,0,0,0.06)",
              color:
                row.status === "draft"
                  ? "green"
                  : row.status === "pending_training"
                    ? "#9a6700"
                    : "crimson",
            }}
          >
            {row.status ?? "—"}
          </span>

          {isReady ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                padding: "5px 9px",
                borderRadius: 999,
                border: "1px solid rgba(0,200,0,0.2)",
                background: "rgba(0,200,0,0.08)",
                color: "green",
              }}
            >
              READY
            </span>
          ) : null}

          {isOverdue ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                padding: "5px 9px",
                borderRadius: 999,
                border: "1px solid rgba(220,0,0,0.2)",
                background: "rgba(220,0,0,0.06)",
                color: "crimson",
              }}
            >
              OVERDUE
            </span>
          ) : null}
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
          Programada: {fmtDate(row.scheduled_for)}
          {daysToDue !== null
            ? ` · ${Math.abs(daysToDue)} ${daysToDue < 0 ? "días tarde" : "días"}`
            : ""}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          {row.template_name ?? "Re-auditoría"}
        </div>

        <div style={{ opacity: 0.9 }}>
          {row.area_name ?? "—"} {row.area_type ? `· ${row.area_type}` : ""}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
              Colaborador
            </div>
            <div>{row.team_member_name ?? "—"}</div>
          </div>

          <ReauditAssignmentSection
            assignedAuditorName={row.assigned_auditor_name}
            assignedAuditorId={row.assigned_auditor_id}
            canReassign={canReassign}
            busy={busy}
            auditorOptions={auditorOptions}
            selectedAuditorId={reassignAuditorValue}
            selectedReason={reassignReasonValue}
            selectedNote={reassignNoteValue}
            onAuditorChange={onReassignAuditorChange}
            onReasonChange={onReassignReasonChange}
            onNoteChange={onReassignNoteChange}
            onSave={onReassignSave}
            onReset={onReassignReset}
            reassignInfo={reassignInfo}
          />

          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
              Training
            </div>
            <div>
              {row.requires_training
                ? row.training_confirmed
                  ? "confirmado"
                  : "pendiente"
                : "no requerido"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
              Blocking issues
            </div>
            <div>{row.blocking_issue_count ?? 0}</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
            Auditoría origen
          </div>
          <div>{row.parent_audit_run_id ?? "—"}</div>
        </div>

        <ReauditTrainingSection
          canConfirmTraining={canConfirmTraining}
          isOpen={isTrainingOpen}
          busy={busy}
          value={trainingValue}
          onChange={onTrainingChange}
          onOpen={onTrainingOpen}
          onCancel={onTrainingCancel}
          onSave={onTrainingSave}
          trainingInfo={trainingInfo}
        />

        {row.notes ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
              Notes
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{row.notes}</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {isReady ? (
          <>
            <div
              style={{
                ...btn,
                cursor: "default",
                background: "rgba(0,200,0,0.08)",
                color: "green",
                border: "1px solid rgba(0,200,0,0.2)",
              }}
            >
              Lista para re-auditar
            </div>

            <button onClick={() => router.push(`/audits/${row.id}`)} style={primaryBtn}>
              Open Re-audit
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}