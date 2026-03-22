"use client";

import { cardStyle, RequirementType, smallBtnStyle } from "../_types";

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  fontWeight: 900,
  outline: "none",
};

function RequirementSelect({
  label,
  value,
  onChange,
  onApply,
  saving,
}: {
  label: string;
  value: RequirementType;
  onChange: (v: RequirementType) => void;
  onApply: () => void;
  saving: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label style={{ fontWeight: 900 }}>{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RequirementType)}
        style={selectStyle}
      >
        <option value="never">Nunca</option>
        <option value="if_fail">Si es FAIL</option>
        <option value="always">Siempre</option>
      </select>
      <button style={smallBtnStyle} onClick={onApply} disabled={saving}>
        Aplicar
      </button>
    </div>
  );
}

type Props = {
  totalCount: number;
  saving: boolean;
  quickComment: RequirementType;
  quickPhoto: RequirementType;
  quickSignature: RequirementType;
  onQuickCommentChange: (v: RequirementType) => void;
  onQuickPhotoChange: (v: RequirementType) => void;
  onQuickSignatureChange: (v: RequirementType) => void;
  onApplyComment: () => void;
  onApplyPhoto: () => void;
  onApplySignature: () => void;
};

export default function QuickRulesCard({
  totalCount,
  saving,
  quickComment,
  quickPhoto,
  quickSignature,
  onQuickCommentChange,
  onQuickPhotoChange,
  onQuickSignatureChange,
  onApplyComment,
  onApplyPhoto,
  onApplySignature,
}: Props) {
  return (
    <div
      style={{
        ...cardStyle,
        marginTop: 14,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontWeight: 950, marginBottom: 4 }}>Reglas rápidas</div>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Aplica requisitos a TODAS las preguntas de esta auditoría.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <RequirementSelect
          label="Comentario"
          value={quickComment}
          onChange={onQuickCommentChange}
          onApply={onApplyComment}
          saving={saving}
        />
        <RequirementSelect
          label="Foto"
          value={quickPhoto}
          onChange={onQuickPhotoChange}
          onApply={onApplyPhoto}
          saving={saving}
        />
        <RequirementSelect
          label="Firma"
          value={quickSignature}
          onChange={onQuickSignatureChange}
          onApply={onApplySignature}
          saving={saving}
        />

        <div style={{ fontWeight: 900, opacity: 0.9, marginLeft: 10 }}>
          Total: {totalCount}
        </div>
      </div>
    </div>
  );
}
