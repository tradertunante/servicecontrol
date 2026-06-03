"use client";

import { useRouter } from "next/navigation";
import BackButton from "@/app/components/BackButton";
import { btnBlackStyle, btnWhiteStyle, TemplateRow } from "../_types";


type Props = {
  templateId: string;
  template: TemplateRow | null;
  saving: boolean;
  error: string | null;
  info: string | null;
  ownerDepartmentAvailable: boolean;
  onToggleActive: () => void;
};

export default function BuilderHeader({
  templateId,
  template,
  saving,
  error,
  info,
  ownerDepartmentAvailable,
  onToggleActive,
}: Props) {
  const router = useRouter();

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <BackButton fallback="/builder" />
          <h1 style={{ fontSize: 56, margin: "10px 0 6px" }}>
            Editor de auditoría
          </h1>
          <div style={{ opacity: 0.85, fontWeight: 900 }}>
            Rol: <span style={{ fontWeight: 950 }}>admin</span> · ID:{" "}
            {template?.id}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/builder/${templateId}/import`)}
            style={btnWhiteStyle}
          >
            Importar Excel
          </button>

          <button
            onClick={onToggleActive}
            style={btnBlackStyle}
            disabled={saving}
          >
            {template?.active === false ? "Activar" : "Desactivar"}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: "crimson", fontWeight: 950 }}>
          {error}
        </div>
      ) : null}

      {info ? (
        <div style={{ marginTop: 12, color: "green", fontWeight: 950 }}>
          {info}
        </div>
      ) : null}

      {!ownerDepartmentAvailable ? (
        <div style={{ marginTop: 12, color: "#8a5a00", fontWeight: 950 }}>
          La columna <code>owner_department</code> aún no existe en esta base
          local. El editor sigue funcionando, pero el selector de Responsable
          quedará deshabilitado hasta aplicar la migración nueva.
        </div>
      ) : null}
    </>
  );
}
