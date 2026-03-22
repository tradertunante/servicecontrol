"use client";

import { AreaRow, btnBlackStyle, cardStyle, TemplateRow } from "../_types";

type Props = {
  template: TemplateRow | null;
  area: AreaRow | null;
  nameDraft: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onSaveName: () => void;
  onUpdateRequirements: (
    patch: Partial<
      Pick<TemplateRow, "require_room_number" | "require_audited_employee">
    >
  ) => void;
};

export default function TemplateSettingsCard({
  template,
  area,
  nameDraft,
  saving,
  onNameChange,
  onSaveName,
  onUpdateRequirements,
}: Props) {
  return (
    <div style={{ ...cardStyle, marginTop: 16 }}>
      <div style={{ fontWeight: 950, marginBottom: 10 }}>
        Datos de la auditoría
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 420, flex: 1 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Nombre</div>
          <input
            value={nameDraft}
            onChange={(e) => onNameChange(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.18)",
              outline: "none",
              fontWeight: 900,
              fontSize: 16,
            }}
          />
        </div>

        <button
          onClick={onSaveName}
          style={{ ...btnBlackStyle, marginTop: 24 }}
          disabled={saving}
        >
          Guardar nombre
        </button>
      </div>

      <div style={{ marginTop: 12, opacity: 0.85, fontWeight: 900 }}>
        Área: {area?.name ?? "—"} {area?.type ? `· ${area.type}` : ""}{" "}
        <span
          style={{
            marginLeft: 10,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.12)",
            fontWeight: 950,
          }}
        >
          {template?.active === false ? "INACTIVA" : "ACTIVA"}
        </span>
      </div>

      <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
        Creada:{" "}
        {template?.created_at
          ? new Date(template.created_at).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })
          : "—"}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Requisitos al enviar</div>

        <label
          style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}
        >
          <input
            type="checkbox"
            checked={!!template?.require_room_number}
            disabled={saving}
            onChange={(e) =>
              onUpdateRequirements({ require_room_number: e.target.checked })
            }
          />
          Requerir número de habitación
        </label>

        <label
          style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}
        >
          <input
            type="checkbox"
            checked={!!template?.require_audited_employee}
            disabled={saving}
            onChange={(e) =>
              onUpdateRequirements({ require_audited_employee: e.target.checked })
            }
          />
          Requerir colaborador auditado
        </label>
      </div>
    </div>
  );
}
