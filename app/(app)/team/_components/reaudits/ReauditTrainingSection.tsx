// FILE: app/(app)/team/_components/reaudits/ReauditTrainingSection.tsx
"use client";

import { fmtDate } from "../../_lib/reauditUtils";
import type { TrainingInfo } from "../../_lib/reauditTypes";

export default function ReauditTrainingSection({
  canConfirmTraining,
  isOpen,
  busy,
  value,
  onChange,
  onOpen,
  onCancel,
  onSave,
  trainingInfo,
}: {
  canConfirmTraining: boolean;
  isOpen: boolean;
  busy: boolean;
  value: string;
  onChange: (value: string) => void;
  onOpen: () => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  trainingInfo: TrainingInfo | null;
}) {
  const btn: React.CSSProperties = {
    padding: "9px 12px",
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

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {trainingInfo?.explanation ? (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
            Training documentado
          </div>

          <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
            {trainingInfo.explanation}
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", overflowWrap: "anywhere" }}>
            {trainingInfo.confirmedBy ? `Por: ${trainingInfo.confirmedBy}` : ""}
            {trainingInfo.confirmedBy && trainingInfo.confirmedAt ? " · " : ""}
            {trainingInfo.confirmedAt ? `Fecha: ${fmtDate(trainingInfo.confirmedAt)}` : ""}
          </div>
        </div>
      ) : null}

      {canConfirmTraining && !isOpen ? (
        <div>
          <button disabled={busy} onClick={onOpen} style={primaryBtn}>
            Documentar training
          </button>
        </div>
      ) : null}

      {canConfirmTraining && isOpen ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,180,0,0.25)",
            background: "rgba(255,180,0,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, lineHeight: 1.25 }}>
            Explica qué se hizo para dejar apto al colaborador para re-auditoría
          </div>

          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ejemplo: coaching 1:1 sobre estándar, shadowing con supervisor, repaso práctico del SOP, checklist reforzado y validación final del proceso..."
            rows={5}
            style={{
              width: "100%",
              resize: "vertical",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
            }}
          />

          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Este texto quedará guardado para trazabilidad y análisis futuro de medidas de formación.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              disabled={busy}
              onClick={onSave}
              style={{
                ...primaryBtn,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "Guardando..." : "Guardar y confirmar training"}
            </button>

            <button disabled={busy} onClick={onCancel} style={btn}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
