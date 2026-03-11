// FILE: app/(app)/team/_components/reaudits/ReauditCard.tsx
"use client";

import { useRouter } from "next/navigation";
import type {
  EnrichedReauditRow,
  ProfileLite,
  ReauditTimelineItem,
  TrainingInfo,
} from "../../_lib/reauditTypes";
import { dayDiffFromNow, fmtDate } from "../../_lib/reauditUtils";
import ReauditAssignmentSection from "./ReauditAssignmentSection";
import ReauditTrainingSection from "./ReauditTrainingSection";
import ReauditTimeline from "./ReauditTimeline";

export default function ReauditCard({
  row,
  busy,
  canManageReauditAssignment,
  auditorOptions,
  trainingValue,
  reassignAuditorValue,
  reassignNoteValue,
  trainingInfo,
  timelineItems,
  onTrainingOpen,
  onTrainingCancel,
  onTrainingChange,
  onTrainingSave,
  onReassignAuditorChange,
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
  reassignNoteValue: string;
  trainingInfo: TrainingInfo | null;
  timelineItems: ReauditTimelineItem[];
  onTrainingOpen: () => void;
  onTrainingCancel: () => void;
  onTrainingChange: (value: string) => void;
  onTrainingSave: () => void | Promise<void>;
  onReassignAuditorChange: (value: string) => void;
  onReassignNoteChange: (value: string) => void;
  onReassignSave: () => void | Promise<void>;
  onReassignReset: () => void;
  isTrainingOpen: boolean;
}) {
  const router = useRouter();

  const btn: React.CSSProperties = {
    padding: "7px 11px",
    borderRadius: 10,
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

  const panelStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    padding: 9,
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--muted)",
    fontWeight: 800,
    lineHeight: 1.2,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  };

  const daysToDue = dayDiffFromNow(row.scheduled_for);
  const isOverdue = daysToDue !== null && daysToDue < 0;
  const isReady = !!row.ready_for_reaudit;
  const hasReauditScore = typeof row.score === "number" && Number.isFinite(row.score);
  const hasOriginalScore =
    typeof row.original_audit_score === "number" &&
    Number.isFinite(row.original_audit_score);
  const improvement =
    typeof row.score === "number" &&
    typeof row.original_audit_score === "number"
      ? row.score - row.original_audit_score
      : null;

  const canConfirmTraining =
    row.status === "pending_training" &&
    row.requires_training === true &&
    row.training_confirmed !== true;

  const isClosed = row.status === "submitted";
  const canReassign = canManageReauditAssignment && !isClosed;

  function formatScore(score: number | null | undefined) {
    return typeof score === "number" && Number.isFinite(score)
      ? `${score.toFixed(1)}%`
      : "—";
  }

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: isReady ? "1px solid rgba(0,200,0,0.30)" : "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "var(--shadow-sm)",
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                padding: "4px 8px",
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
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "4px 8px",
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
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "4px 8px",
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

          <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.15 }}>
            {row.template_name ?? "Re-auditoría"}
          </div>

          <div style={{ opacity: 0.9, overflowWrap: "anywhere" }}>
            {row.area_name ?? "—"} {row.area_type ? `· ${row.area_type}` : ""}
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "var(--muted)",
            fontWeight: 800,
            whiteSpace: "normal",
            textAlign: "left",
            overflowWrap: "anywhere",
          }}
        >
          Programada: {fmtDate(row.scheduled_for)}
          {daysToDue !== null
            ? ` · ${Math.abs(daysToDue)} ${daysToDue < 0 ? "días tarde" : "días"}`
            : ""}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
        }}
      >
        <div style={panelStyle}>
          <div style={labelStyle}>Colaborador</div>
          <div style={valueStyle}>{row.team_member_name ?? "—"}</div>
        </div>

        <div style={panelStyle}>
          <div style={labelStyle}>Auditor asignado</div>
          <div style={valueStyle}>{row.assigned_auditor_name ?? "—"}</div>
        </div>

        <div style={panelStyle}>
          <div style={labelStyle}>Training</div>
          <div style={valueStyle}>
            {row.requires_training
              ? row.training_confirmed
                ? "confirmado"
                : "pendiente"
              : "no requerido"}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={labelStyle}>Blocking issues</div>
          <div style={valueStyle}>{row.blocking_issue_count ?? 0}</div>
        </div>
      </div>

      <div
        style={{
          ...panelStyle,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span style={labelStyle}>Score original</span>
            <span style={valueStyle}>{formatScore(row.original_audit_score)}</span>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
            <span style={labelStyle}>Reauditoría</span>
            <span style={valueStyle}>
              {hasReauditScore ? formatScore(row.score) : "Pendiente"}
            </span>
          </div>
        </div>

        {improvement !== null ? (
          <div
            style={{
              ...valueStyle,
              color: improvement > 0 ? "green" : improvement < 0 ? "crimson" : "inherit",
              whiteSpace: "normal",
            }}
          >
            Mejora: {improvement > 0 ? "+" : ""}
            {improvement.toFixed(2)} pts
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 8,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          <ReauditAssignmentSection
            assignedAuditorName={row.assigned_auditor_name}
            assignedAuditorId={row.assigned_auditor_id}
            canReassign={canReassign}
            busy={busy}
            auditorOptions={auditorOptions}
            selectedAuditorId={reassignAuditorValue}
            selectedNote={reassignNoteValue}
            onAuditorChange={onReassignAuditorChange}
            onNoteChange={onReassignNoteChange}
            onSave={onReassignSave}
            onReset={onReassignReset}
          />

          <div style={panelStyle}>
            <div style={labelStyle}>Auditoría origen</div>
            <div style={valueStyle}>{row.parent_audit_run_id ?? "—"}</div>
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
        </div>

        <div style={{ minWidth: 0 }}>
          <ReauditTimeline items={timelineItems} />
        </div>
      </div>

      {isReady ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
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
        </div>
      ) : null}
    </div>
  );
}
