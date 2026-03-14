"use client";

import type { CSSProperties } from "react";
import type { MemberAreaOption } from "../_lib/memberTypes";

type MemberFormValues = {
  full_name: string;
  employee_number: string;
  active: boolean;
  area_ids: string[];
};

function inputStyle(): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    width: "100%",
    background: "#fff",
  };
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "#111827",
    color: disabled ? "#9ca3af" : "#fff",
    padding: "10px 12px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function secondaryButtonStyle(): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    padding: "10px 12px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default function MemberForm({
  title,
  values,
  areaOptions,
  busy,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  values: MemberFormValues;
  areaOptions: MemberAreaOption[];
  busy: boolean;
  submitLabel: string;
  onChange: (next: MemberFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        padding: 16,
        borderRadius: 12,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>

      <input
        value={values.full_name}
        onChange={(event) => onChange({ ...values, full_name: event.target.value })}
        placeholder="Nombre del miembro"
        style={inputStyle()}
      />

      <input
        value={values.employee_number}
        onChange={(event) => onChange({ ...values, employee_number: event.target.value })}
        placeholder="Numero de colaborador"
        style={inputStyle()}
      />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={values.active}
          onChange={(event) => onChange({ ...values, active: event.target.checked })}
        />
        Miembro activo
      </label>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Areas asignadas</div>
        <div style={{ display: "grid", gap: 8 }}>
          {areaOptions.map((area) => {
            const checked = values.area_ids.includes(area.id);
            return (
              <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const nextAreaIds = event.target.checked
                      ? [...values.area_ids, area.id]
                      : values.area_ids.filter((areaId) => areaId !== area.id);
                    onChange({ ...values, area_ids: nextAreaIds });
                  }}
                />
                {area.name}
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onSubmit} disabled={busy} style={buttonStyle(busy)}>
          {busy ? "Guardando..." : submitLabel}
        </button>
        {onCancel ? (
          <button onClick={onCancel} type="button" style={secondaryButtonStyle()}>
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
