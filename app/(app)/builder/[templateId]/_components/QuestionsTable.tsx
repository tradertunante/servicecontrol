"use client";

import {
  btnWhiteStyle,
  cardStyle,
  CertificationStandardRow,
  RequirementType,
  ResponsibleDepartmentOption,
  UiRow,
} from "../_types";
import QuestionTableRow from "./QuestionTableRow";

type Props = {
  rows: UiRow[];
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
  onDeleteAll: () => void;
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid rgba(0,0,0,0.15)",
  position: "sticky",
  top: 0,
  background: "#fff",
  zIndex: 1,
};

export default function QuestionsTable({
  rows,
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
  onDeleteAll,
}: Props) {
  return (
    <div style={{ ...cardStyle, marginTop: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Preguntas (tabla)</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            STANDARD — Responsable — TAG — CLASSIFICATION — Comentario — Foto —
            Firma
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.06)",
              fontWeight: 900,
            }}
          >
            Edición inline (se guarda al salir)
          </span>

          <button
            onClick={onDeleteAll}
            style={{ ...btnWhiteStyle, borderColor: "rgba(200,0,0,0.35)" }}
            disabled={saving}
          >
            Borrar todas
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto", overflowY: "auto", maxHeight: "calc(100dvh - 460px)", minHeight: 200 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 1560 + 420 + certifications.length * 90,
          }}
        >
          <colgroup>
            <col style={{ width: 90 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 660 }} />
            <col style={{ width: 420 }} />
            {certifications.map((cert) => (
              <col key={cert.id} style={{ width: 90 }} />
            ))}
            <col style={{ width: 220 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
          </colgroup>

          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={thStyle}>ORD</th>
              <th style={thStyle}>CLASSIFICATION</th>
              <th style={thStyle}>TAG</th>
              <th style={thStyle}>STANDARD</th>
              <th style={thStyle}>STANDARD (EN)</th>
              {certifications.map((cert) => (
                <th
                  key={cert.id}
                  style={{ ...thStyle, textAlign: "center" }}
                  title={cert.name}
                >
                  {cert.name}
                </th>
              ))}
              <th style={thStyle}>Responsable</th>
              <th style={thStyle}>Comentario</th>
              <th style={thStyle}>Foto</th>
              <th style={thStyle}>Firma</th>
              <th style={thStyle}>Activa</th>
              <th style={thStyle}>Borrar</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const sameSection = rows
                .filter((x) => x.sectionId === row.sectionId)
                .sort(
                  (a, b) =>
                    a.order - b.order ||
                    a.questionId.localeCompare(b.questionId)
                );
              const pos = sameSection.findIndex(
                (x) => x.questionId === row.questionId
              );
              const canUp = pos > 0;
              const canDown = pos !== -1 && pos < sameSection.length - 1;

              return (
                <QuestionTableRow
                  key={row.questionId}
                  row={row}
                  canUp={canUp}
                  canDown={canDown}
                  saving={saving}
                  certifications={certifications}
                  onToggleCertification={onToggleCertification}
                  ownerDepartmentAvailable={ownerDepartmentAvailable}
                  responsibleDepartmentOptions={responsibleDepartmentOptions}
                  templateResponsibleLabel={templateResponsibleLabel}
                  responsibleDepartmentLabelByValue={
                    responsibleDepartmentLabelByValue
                  }
                  onMove={onMove}
                  onTagChange={onTagChange}
                  onTagBlur={onTagBlur}
                  onStandardChange={onStandardChange}
                  onStandardBlur={onStandardBlur}
                  onStandardEnChange={onStandardEnChange}
                  onStandardEnBlur={onStandardEnBlur}
                  onOwnerChange={onOwnerChange}
                  onRequirementChange={onRequirementChange}
                  onRequirementSave={onRequirementSave}
                  onActiveChange={onActiveChange}
                  onDelete={onDelete}
                />
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={11 + certifications.length} style={{ padding: 14, opacity: 0.8 }}>
                  No hay preguntas. Importa desde Excel o crea preguntas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, opacity: 0.75, fontSize: 13 }}>
        Nota: el orden (↑/↓) reordena dentro de la misma{" "}
        <strong>CLASSIFICATION</strong> (sección).
      </div>
    </div>
  );
}
