// FILE: app/(app)/team/_components/target-assignments/TemplateAssignmentCard.tsx
"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type {
  AreaTemplateTargetRow,
  AssignmentRow,
  TeamUserRow,
} from "./types";
import {
  getAssignmentStatus,
  getTemplateName,
  normalizeAssignmentValue,
} from "./types";
import UserAssignmentRow from "./UserAssignmentRow";

type Props = {
  btn: CSSProperties;
  input: CSSProperties;
  target: AreaTemplateTargetRow;
  selectedPeriod: string;
  teamUsers: TeamUserRow[];
  managerId: string | null;
  templateAssignments: Record<string, AssignmentRow>;
  templateDirty: boolean;
  templateHint: string;
  saving: boolean;
  loading: boolean;
  onUpdateAssignment: (templateId: string, userId: string, value: number) => void;
  onAutoDistribute: (templateId: string, targetCount: number) => void;
  onAutoDistributeByLoad: (templateId: string, targetCount: number) => void;
  onSave: (templateId: string) => void;
};

export default function TemplateAssignmentCard({
  btn,
  input,
  target,
  selectedPeriod,
  teamUsers,
  managerId,
  templateAssignments,
  templateDirty,
  templateHint,
  saving,
  loading,
  onUpdateAssignment,
  onAutoDistribute,
  onAutoDistributeByLoad,
  onSave,
}: Props) {
  const t = useTranslations("app.team.targets");
  const templateId = target.audit_template_id;
  const targetCount = Number(target.target_count ?? 0);

  const assignedTotal = Object.values(templateAssignments).reduce(
    (acc, row) => acc + Number(row.target_count ?? 0),
    0
  );

  const remaining = Math.max(targetCount - assignedTotal, 0);
  const status = getAssignmentStatus(targetCount, assignedTotal, true);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        padding: 14,
        background: "rgba(0,0,0,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {getTemplateName(target)}
          </div>
          <div style={{ opacity: 0.78, marginTop: 4, fontSize: 13 }}>
            {t("templatePeriodSubtitle", {
              period: selectedPeriod === "daily"
                ? t("periodLabelDaily")
                : selectedPeriod === "weekly"
                ? t("periodLabelWeekly")
                : t("periodLabelMonthly"),
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={btn}
            onClick={() => onAutoDistribute(templateId, targetCount)}
            disabled={saving || loading || teamUsers.length === 0}
          >
            {t("autoDistribute")}
          </button>
          <button
            style={btn}
            onClick={() => onAutoDistributeByLoad(templateId, targetCount)}
            disabled={saving || loading || teamUsers.length === 0}
          >
            {t("autoDistributeByLoad")}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 8,
            minWidth: 320,
            flex: 1,
          }}
        >
          <div style={input}>{t("metaTarget")} {targetCount}</div>
          <div style={input}>{t("metaAssigned")} {normalizeAssignmentValue(assignedTotal)} / {targetCount}</div>
          <div style={input}>{t("metaPending")} {remaining}</div>
          <div style={input}>{t("metaStatus")} {status}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {teamUsers.map((user) => {
          const row = templateAssignments[user.id] ?? {
            user_id: user.id,
            target_count: 0,
            active: true,
          };

          return (
            <UserAssignmentRow
              key={`${templateId}_${user.id}`}
              input={input}
              user={user}
              managerId={managerId}
              templateId={templateId}
              row={row}
              onUpdate={onUpdateAssignment}
            />
          );
        })}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ opacity: 0.8, fontSize: 12.5 }}>
          {templateDirty
            ? t("unsavedChanges")
            : templateHint || t("noChanges")}
        </div>

        <button
          style={btn}
          onClick={() => onSave(templateId)}
          disabled={saving || loading || !templateDirty}
        >
          {saving ? t("saving") : t("saveTemplate")}
        </button>
      </div>
    </div>
  );
}
