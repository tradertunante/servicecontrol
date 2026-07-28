"use client";

import { useState } from "react";
import { CertificationStandardRow, cardStyle, smallBtnStyle } from "../_types";

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  outline: "none",
  fontWeight: 900,
};

type Props = {
  certifications: CertificationStandardRow[];
  hotelIdAvailable: boolean;
  saving: boolean;
  onCreate: (name: string) => void;
  onRename: (certificationId: string, name: string) => void;
  onDeactivate: (certificationId: string) => void;
};

export default function CertificationsManagerCard({
  certifications,
  hotelIdAvailable,
  saving,
  onCreate,
  onRename,
  onDeactivate,
}: Props) {
  const [newName, setNewName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  return (
    <div style={{ ...cardStyle, marginTop: 14 }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>Certificados / Estándares</div>
      <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
        Marca en cada pregunta de la tabla a qué certificado(s) aplica (Forbes,
        LHW, Meliá, etc.). Con una sola auditoría se calculará el resultado de
        cumplimiento de forma independiente para cada certificado.
      </div>

      {!hotelIdAvailable ? (
        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
          Esta auditoría no tiene un hotel asociado todavía; asigna un área
          para poder crear certificados.
        </div>
      ) : (
        <>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {certifications.map((cert) => {
              const draft = renameDrafts[cert.id] ?? cert.name;
              return (
                <div
                  key={cert.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "rgba(0,0,0,0.03)",
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) =>
                      setRenameDrafts((prev) => ({ ...prev, [cert.id]: e.target.value }))
                    }
                    onBlur={() => {
                      const trimmed = draft.trim();
                      if (trimmed && trimmed !== cert.name) onRename(cert.id, trimmed);
                    }}
                    disabled={saving}
                    style={{ ...inputStyle, padding: "4px 8px", width: 140 }}
                  />
                  <button
                    onClick={() => onDeactivate(cert.id)}
                    disabled={saving}
                    title="Desactivar certificado"
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: saving ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      opacity: 0.7,
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {certifications.length === 0 ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Todavía no hay certificados creados para este hotel.
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej: Forbes Travel Standards"
              style={inputStyle}
              disabled={saving}
            />
            <button
              style={smallBtnStyle}
              disabled={saving || !newName.trim()}
              onClick={() => {
                onCreate(newName);
                setNewName("");
              }}
            >
              + Añadir certificado
            </button>
          </div>
        </>
      )}
    </div>
  );
}
