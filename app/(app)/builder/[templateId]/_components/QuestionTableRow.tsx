"use client";

import {
  CertificationStandardRow,
  RequirementType,
  ResponsibleDepartmentOption,
  toResponsibleDepartment,
  UiRow,
} from "../_types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.18)",
  outline: "none",
  fontWeight: 900,
  background: "#fff",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.18)",
  outline: "none",
  fontWeight: 900,
  background: "#fff",
};

function RequirementCell({
  value,
  questionId,
  field,
  saving,
  onLocalChange,
  onSave,
}: {
  value: RequirementType;
  questionId: string;
  field: "comment_requirement" | "photo_requirement" | "signature_requirement";
  saving: boolean;
  onLocalChange: (questionId: string, field: string, value: RequirementType) => void;
  onSave: (questionId: string, patch: Record<string, RequirementType>) => void;
}) {
  return (
    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value as RequirementType;
          onLocalChange(questionId, field, v);
          onSave(questionId, { [field]: v });
        }}
        style={selectStyle}
        disabled={saving}
      >
        <option value="never">Nunca</option>
        <option value="if_fail">Si es FAIL</option>
        <option value="optional">Opcional</option>
        <option value="always">Siempre</option>
      </select>
    </td>
  );
}

type Props = {
  row: UiRow;
  canUp: boolean;
  canDown: boolean;
  saving: boolean;
  certifications: CertificationStandardRow[];
  onToggleCertification: (questionId: string, certificationId: string, checked: boolean) => void;
  ownerDepartmentAvailable: boolean;
  responsibleDepartmentOptions: ResponsibleDepartmentOption[];
  templateResponsibleLabel: string;
  responsibleDepartmentLabelByValue: Map<string, string>;
  onMove: (questionId: string, dir: "up" | "down") => void;
  onTagChange: (questionId: string, value: string) => void;
  onTagBlur: (questionId: string, value: string) => void;
  onStandardChange: (questionId: string, value: string) => void;
  onStandardBlur: (questionId: string, value: string) => void;
  onStandardEnChange: (questionId: string, value: string) => void;
  onStandardEnBlur: (questionId: string, value: string) => void;
  onOwnerChange: (questionId: string, value: string | null) => void;
  onRequirementChange: (questionId: string, field: string, value: RequirementType) => void;
  onRequirementSave: (questionId: string, patch: Record<string, RequirementType>) => void;
  onActiveChange: (questionId: string, value: boolean) => void;
  onDelete: (questionId: string) => void;
};

export default function QuestionTableRow({
  row,
  canUp,
  canDown,
  saving,
  certifications,
  onToggleCertification,
  ownerDepartmentAvailable,
  responsibleDepartmentOptions,
  templateResponsibleLabel,
  responsibleDepartmentLabelByValue,
  onMove,
  onTagChange,
  onTagBlur,
  onStandardChange,
  onStandardBlur,
  onStandardEnChange,
  onStandardEnBlur,
  onOwnerChange,
  onRequirementChange,
  onRequirementSave,
  onActiveChange,
  onDelete,
}: Props) {
  return (
    <tr key={row.questionId} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      {/* Order / move buttons */}
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            title="Subir"
            onClick={() => onMove(row.questionId, "up")}
            disabled={saving || !canUp}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#fff",
              cursor: saving || !canUp ? "not-allowed" : "pointer",
              opacity: saving || !canUp ? 0.5 : 1,
              fontWeight: 950,
            }}
          >
            ↑
          </button>
          <button
            title="Bajar"
            onClick={() => onMove(row.questionId, "down")}
            disabled={saving || !canDown}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#fff",
              cursor: saving || !canDown ? "not-allowed" : "pointer",
              opacity: saving || !canDown ? 0.5 : 1,
              fontWeight: 950,
            }}
          >
            ↓
          </button>
        </div>
        <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12, fontWeight: 900 }}>
          {row.order}
        </div>
      </td>

      {/* Classification */}
      <td style={{ padding: "10px 8px", verticalAlign: "top", fontWeight: 950 }}>
        {row.classification}
      </td>

      {/* TAG */}
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <input
          value={row.tag}
          onChange={(e) => onTagChange(row.questionId, e.target.value)}
          onBlur={() => onTagBlur(row.questionId, row.tag.trim())}
          placeholder="Ej: Service"
          style={inputStyle}
        />
      </td>

      {/* Standard (text) */}
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <textarea
          value={row.standard}
          onChange={(e) => onStandardChange(row.questionId, e.target.value)}
          onBlur={() => onStandardBlur(row.questionId, row.standard.trim())}
          style={{
            ...inputStyle,
            minHeight: 64,
            resize: "vertical",
          }}
        />
      </td>

      {/* Standard (English, opcional) */}
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <textarea
          value={row.standardEn}
          onChange={(e) => onStandardEnChange(row.questionId, e.target.value)}
          onBlur={() => onStandardEnBlur(row.questionId, row.standardEn.trim())}
          placeholder="English (opcional)"
          style={{
            ...inputStyle,
            minHeight: 64,
            resize: "vertical",
          }}
        />
      </td>

      {/* Certificaciones (Forbes / LHW / Meliá, etc.) */}
      {certifications.map((cert) => {
        const checked = row.certificationIds.includes(cert.id);
        return (
          <td
            key={cert.id}
            style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={saving}
              onChange={(e) =>
                onToggleCertification(row.questionId, cert.id, e.target.checked)
              }
            />
          </td>
        );
      })}

      {/* Owner department */}
      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
        <select
          value={row.owner_department ?? "__default__"}
          disabled={!ownerDepartmentAvailable}
          onChange={(e) => {
            if (!ownerDepartmentAvailable) return;
            const v =
              e.target.value === "__default__"
                ? null
                : toResponsibleDepartment(e.target.value);
            onOwnerChange(row.questionId, v);
          }}
          style={{
            ...selectStyle,
            background: ownerDepartmentAvailable ? "#fff" : "rgba(0,0,0,0.04)",
            cursor: ownerDepartmentAvailable ? "pointer" : "not-allowed",
            opacity: ownerDepartmentAvailable ? 1 : 0.7,
          }}
        >
          <option value="__default__">
            Por defecto ({templateResponsibleLabel})
          </option>
          {responsibleDepartmentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72, fontWeight: 800 }}>
          {row.owner_department
            ? `Actual: ${
                responsibleDepartmentLabelByValue.get(row.owner_department) ??
                row.owner_department
              } · override manual`
            : `Actual: ${templateResponsibleLabel} · heredado del template`}
        </div>
      </td>

      {/* Comment requirement */}
      <RequirementCell
        value={row.comment_requirement}
        questionId={row.questionId}
        field="comment_requirement"
        saving={saving}
        onLocalChange={onRequirementChange}
        onSave={onRequirementSave}
      />

      {/* Photo requirement */}
      <RequirementCell
        value={row.photo_requirement}
        questionId={row.questionId}
        field="photo_requirement"
        saving={saving}
        onLocalChange={onRequirementChange}
        onSave={onRequirementSave}
      />

      {/* Signature requirement */}
      <RequirementCell
        value={row.signature_requirement}
        questionId={row.questionId}
        field="signature_requirement"
        saving={saving}
        onLocalChange={onRequirementChange}
        onSave={onRequirementSave}
      />

      {/* Active */}
      <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}>
        <input
          type="checkbox"
          checked={row.active}
          onChange={(e) => onActiveChange(row.questionId, e.target.checked)}
        />
      </td>

      {/* Delete */}
      <td style={{ padding: "10px 8px", verticalAlign: "top", textAlign: "center" }}>
        <button
          onClick={() => onDelete(row.questionId)}
          disabled={saving}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            fontWeight: 950,
          }}
          title="Borrar"
        >
          🗑️
        </button>
      </td>
    </tr>
  );
}
