"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { AuditReportData } from "@/lib/reports/auditReportTypes";
import { exportAuditReportToExcel } from "@/lib/reports/exportExcel";

const SUCCESS_SCORE_MIN = 90;
const WARNING_SCORE_MIN = 75;
const SUCCESS_FAIL_RATE_MAX = 5; // %
const WARNING_FAIL_RATE_MAX = 15; // %

function pageStyle(): CSSProperties {
  return {
    padding: 24,
    width: "100%",
    maxWidth: "none",
    background: "#f7f7f8",
    minHeight: "100vh",
  };
}

function paperStyle(): CSSProperties {
  return {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 14px 40px rgba(0,0,0,0.10)",
    border: "1px solid rgba(0,0,0,0.08)",
  };
}

function sectionCardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 16,
    background: "#fff",
  };
}

function kpiStyle(): CSSProperties {
  return {
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 16,
    background: "#fafafa",
  };
}

function btnStyle(dark = false): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: dark ? "#111" : "#fff",
    color: dark ? "#fff" : "#111",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function badgeStyle(status: "FAIL" | "NA" | "OK"): CSSProperties {
  if (status === "FAIL") {
    return {
      background: "rgba(220, 38, 38, 0.10)",
      color: "#b91c1c",
      border: "1px solid rgba(220, 38, 38, 0.18)",
    };
  }
  if (status === "NA") {
    return {
      background: "rgba(55, 65, 81, 0.10)",
      color: "#374151",
      border: "1px solid rgba(55, 65, 81, 0.18)",
    };
  }
  return {
    background: "rgba(22, 163, 74, 0.10)",
    color: "#15803d",
    border: "1px solid rgba(22, 163, 74, 0.18)",
  };
}

function summaryToneStyle(tone: "good" | "warning" | "critical"): CSSProperties {
  if (tone === "good") {
    return {
      background: "rgba(22, 163, 74, 0.08)",
      border: "1px solid rgba(22, 163, 74, 0.18)",
      color: "#166534",
    };
  }
  if (tone === "critical") {
    return {
      background: "rgba(220, 38, 38, 0.08)",
      border: "1px solid rgba(220, 38, 38, 0.18)",
      color: "#991b1b",
    };
  }
  return {
    background: "rgba(245, 158, 11, 0.10)",
    border: "1px solid rgba(245, 158, 11, 0.20)",
    color: "#92400e",
  };
}

function fieldLabelStyle(): CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.72,
    fontWeight: 900,
    marginBottom: 8,
  };
}

function editableInputStyle(): CSSProperties {
  return {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    background: "#fff",
    padding: "10px 12px",
    fontSize: 14,
    lineHeight: 1.4,
    outline: "none",
    fontFamily: "inherit",
  };
}

function editableTextareaStyle(): CSSProperties {
  return {
    width: "100%",
    minHeight: 140,
    resize: "vertical",
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    background: "#fff",
    padding: "12px 14px",
    fontSize: 15,
    lineHeight: 1.6,
    outline: "none",
    fontFamily: "inherit",
  };
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function AuditReportPageClient({
  report,
}: {
  report: AuditReportData;
}) {
  const router = useRouter();

  const [trainingAction, setTrainingAction] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [trainerName, setTrainerName] = useState("");

  const failedItems = useMemo(() => {
    return (report?.sections ?? []).flatMap((section) =>
      section.items.filter((item) => item.status === "FAIL")
    );
  }, [report]);

  const passedItems = useMemo(() => {
    return (report?.sections ?? []).flatMap((section) =>
      section.items.filter((item) => item.status === "OK")
    );
  }, [report]);

  // Flat list: one entry per photo (questions can have up to 5 photos each)
  const photoItems = useMemo(() => {
    let idx = 0;
    return (report?.sections ?? [])
      .flatMap((s) => s.items)
      .filter((item) => item.photo_urls.length > 0)
      .flatMap((item) =>
        item.photo_urls.map((url) => ({ ...item, photo_url: url, photoNumber: ++idx }))
      );
  }, [report]);

  const photoNumberByQuestionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of photoItems) {
      if (!map.has(p.question_id)) map.set(p.question_id, p.photoNumber);
    }
    return map;
  }, [photoItems]);

  const photoCountByQuestionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of photoItems) map.set(p.question_id, (map.get(p.question_id) ?? 0) + 1);
    return map;
  }, [photoItems]);

  const showTrainingSignoff = useMemo(() => {
    return (report?.summary.fail ?? 0) > 0;
  }, [report]);

  const failRatePct = useMemo(() => {
    if (!report) return 0;
    if (!report.summary.total) return 0;
    return (report.summary.fail / report.summary.total) * 100;
  }, [report]);

  const executiveSummary = useMemo(() => {
    if (!report) {
      return {
        label: "",
        tone: "warning" as const,
        text: "",
      };
    }

    const score = typeof report.run.score === "number" ? report.run.score : null;

    const sectionsWithFails = [...report.sections]
      .filter((section) => section.fail > 0)
      .sort((a, b) => b.fail - a.fail);

    const topSections = sectionsWithFails.slice(0, 2).map((s) => s.section_name);

    const joinSections = (names: string[]) => {
      if (names.length === 0) return "";
      if (names.length === 1) return names[0];
      return `${names[0]} y ${names[1]}`;
    };

    const focusAreas = joinSections(topSections);

    const isStrong =
      score !== null &&
      score >= SUCCESS_SCORE_MIN &&
      failRatePct <= SUCCESS_FAIL_RATE_MAX;

    const isWarning =
      score !== null &&
      score >= WARNING_SCORE_MIN &&
      failRatePct <= WARNING_FAIL_RATE_MAX;

    if (report.summary.fail === 0 && report.summary.na === 0 && isStrong) {
      return {
        label: "Strong result",
        tone: "good" as const,
        text:
          "No se detectaron hallazgos críticos en la auditoría. El resultado refleja cumplimiento consistente en los ítems evaluados, sin respuestas en FAIL ni NA.",
      };
    }

    if (report.summary.fail === 0 && report.summary.na > 0) {
      return {
        label: "Review advised",
        tone: "warning" as const,
        text:
          "No se detectaron respuestas en FAIL, pero existen ítems marcados como NA. Conviene revisar su justificación para asegurar consistencia en la evaluación.",
      };
    }

    if (isStrong) {
      return {
        label: "Strong result",
        tone: "good" as const,
        text: focusAreas
          ? `La auditoría mantiene un resultado sólido. Aunque existen incidencias puntuales, estas se concentran principalmente en ${focusAreas} y no comprometen el resultado general.`
          : "La auditoría mantiene un resultado sólido. Las incidencias observadas son puntuales y no comprometen el resultado general.",
      };
    }

    if (isWarning) {
      return {
        label: "Needs attention",
        tone: "warning" as const,
        text: focusAreas
          ? `La auditoría se sitúa en una zona de atención. Los hallazgos se concentran principalmente en ${focusAreas}, por lo que conviene corregirlos y dar seguimiento en la siguiente revisión.`
          : "La auditoría se sitúa en una zona de atención. Conviene corregir los hallazgos detectados y verificar su cierre en la siguiente revisión.",
      };
    }

    return {
      label: "Priority action",
      tone: "critical" as const,
      text: focusAreas
        ? `La auditoría presenta un resultado por debajo del umbral esperado. Los principales hallazgos se concentran en ${focusAreas}, por lo que se recomienda acción correctiva prioritaria y seguimiento específico en las áreas afectadas.`
        : "La auditoría presenta un resultado por debajo del umbral esperado. Se recomienda acción correctiva prioritaria y seguimiento específico de los hallazgos detectados.",
    };
  }, [report, failRatePct]);

  const scoreLabel =
    typeof report.run.score === "number"
      ? `${Number.isInteger(report.run.score) ? report.run.score : report.run.score.toFixed(1)}%`
      : "-";

  return (
    <main className="audit-report-main" style={pageStyle()}>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          [data-no-print] {
            display: none !important;
          }

          main {
            padding-top: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            max-width: 100% !important;
          }

          html {
            zoom: 0.65;
          }

          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            font-size: 9px !important;
            line-height: 1.3 !important;
          }

          /* neutralize app shell wrapper that forces 100vh → blank page */
          .min-h-screen {
            min-height: 0 !important;
          }

          .report-no-print {
            display: none !important;
          }

          .report-paper {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          .report-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .report-header-grid {
            display: grid !important;
            grid-template-columns: 1.5fr 0.9fr !important;
            gap: 8px !important;
            align-items: start !important;
          }

          .report-kpi-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 6px !important;
          }

          .report-section-row {
            padding: 6px 10px !important;
            border-radius: 6px !important;
          }

          .report-card {
            padding: 7px 10px !important;
            border-radius: 6px !important;
          }

          .report-title-xl {
            font-size: 17px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
          }

          .report-title-lg {
            font-size: 13px !important;
            line-height: 1.15 !important;
            margin: 0 0 5px 0 !important;
          }

          .report-score-box {
            padding: 8px 10px !important;
            border-radius: 8px !important;
          }

          .report-score-value {
            font-size: 24px !important;
            line-height: 1 !important;
            margin-top: 4px !important;
          }

          .report-kpi-value {
            font-size: 16px !important;
            line-height: 1 !important;
            margin-top: 3px !important;
          }

          .report-body-padding {
            padding: 10px !important;
          }

          .report-mt-24 {
            margin-top: 10px !important;
          }

          .report-mt-28 {
            margin-top: 12px !important;
          }

          .report-badge {
            padding: 2px 6px !important;
            border-radius: 999px !important;
            font-size: 8px !important;
            font-weight: 900 !important;
          }

          .audit-report-main {
            padding: 0 !important;
            min-height: 0 !important;
          }

          .training-signature-box {
            min-height: 70px !important;
          }

          .editable-training-input,
          .editable-training-textarea {
            border: 1px solid rgba(0, 0, 0, 0.12) !important;
            background: #fff !important;
            box-shadow: none !important;
            outline: none !important;
            color: #111 !important;
          }

          .editable-training-textarea {
            min-height: 80px !important;
            resize: none !important;
          }

          .report-photo-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }

          .report-photo-card img {
            max-height: 200px !important;
          }
        }

        @media (max-width: 720px) {
          .audit-report-main { padding: 10px 6px !important; }
          .report-no-print {
            padding: 12px !important;
            flex-direction: column !important;
            gap: 8px !important;
            align-items: stretch !important;
          }
          .report-no-print > div:first-child { display: none !important; }
          .audit-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .audit-actions > button:first-child { grid-column: 1 / -1 !important; }
          .audit-actions > button {
            width: 100% !important;
            box-sizing: border-box !important;
            min-height: 44px !important;
            font-size: 14px !important;
          }
          .report-body-padding { padding: 16px 14px !important; }
          .report-header-grid { display: block !important; grid-template-columns: unset !important; }
          .report-score-box {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 14px !important;
            text-align: left !important;
            padding: 14px 16px !important;
            margin-top: 14px;
          }
          .report-score-value { font-size: 36px !important; margin-top: 0 !important; flex-shrink: 0; }
          .report-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .report-title-lg { font-size: 18px !important; margin-bottom: 10px !important; }
        }
      `}</style>

      <div className="report-paper" style={paperStyle()}>
        <div
          className="report-no-print"
          style={{
            padding: 20,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            background: "#fcfcfc",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, opacity: 0.65 }}>ServiceControl</div>
            <div style={{ fontSize: 13, opacity: 0.55 }}>Vista imprimible de auditoría</div>
          </div>

          <div className="audit-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => window.print()} style={btnStyle(true)}>
              Imprimir / PDF
            </button>
            <button onClick={() => exportAuditReportToExcel(report)} style={btnStyle(false)}>
              Exportar Excel
            </button>
            <button
              onClick={() => router.push(`/areas/${report.run.area_id}/history/${report.run.id}`)}
              style={btnStyle(false)}
            >
              Ver detalle
            </button>
          </div>
        </div>

        <div className="report-body-padding" style={{ padding: 28 }}>
          <header
            className="report-break-avoid report-header-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: 18,
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  opacity: 0.55,
                  marginBottom: 8,
                }}
              >
                Audit report
              </div>

              <h1
                className="report-title-xl"
                style={{ margin: 0, fontSize: "clamp(20px, 5vw, 40px)", lineHeight: 1.05 }}
              >
                {report.template?.name ?? "Auditoría"}
              </h1>

              <div style={{ marginTop: 14, lineHeight: 1.7 }}>
                <div>
                  <strong>Área:</strong> {report.area?.name ?? report.run.area_id}{" "}
                  {report.area?.type ? `(${report.area.type})` : ""}
                </div>
                {report.run.room_number ? (
                  <div>
                    <strong>Habitación:</strong> {report.run.room_number}
                  </div>
                ) : null}
                <div>
                  <strong>Ejecutada:</strong>{" "}
                  {report.run.executed_at
                    ? new Date(report.run.executed_at).toLocaleString("es-ES")
                    : "No ejecutada"}
                </div>
              </div>
            </div>

            <div
              className="report-score-box"
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 20,
                padding: 22,
                background: "#fafafa",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: 0.55,
                  textTransform: "uppercase",
                }}
              >
                Score final
              </div>
              <div
                className="report-score-value"
                style={{ fontSize: 46, fontWeight: 900, lineHeight: 1, marginTop: 10 }}
              >
                {scoreLabel}
              </div>
            </div>
          </header>

          <section
            className="report-break-avoid report-kpi-grid report-mt-24"
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div className="report-card" style={kpiStyle()}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>Total</div>
              <div
                className="report-kpi-value"
                style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}
              >
                {report.summary.total}
              </div>
            </div>

            <div className="report-card" style={kpiStyle()}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>FAIL</div>
              <div
                className="report-kpi-value"
                style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: "#b91c1c" }}
              >
                {report.summary.fail}
              </div>
            </div>

            <div className="report-card" style={kpiStyle()}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>NA</div>
              <div
                className="report-kpi-value"
                style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: "#374151" }}
              >
                {report.summary.na}
              </div>
            </div>

            <div className="report-card" style={kpiStyle()}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>Pass</div>
              <div
                className="report-kpi-value"
                style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: "#15803d" }}
              >
                {report.summary.ok}
              </div>
            </div>
          </section>

          <section className="report-break-avoid report-mt-24" style={{ marginTop: 24 }}>
            <div
              className="report-card"
              style={{
                ...sectionCardStyle(),
                ...summaryToneStyle(executiveSummary.tone),
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <div
                  className="report-title-lg"
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 900,
                    lineHeight: 1.15,
                  }}
                >
                  Executive Summary
                </div>

                <span
                  className="report-badge"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    ...summaryToneStyle(executiveSummary.tone),
                  }}
                >
                  {executiveSummary.label}
                </span>
              </div>

              <div
                style={{
                  fontSize: 15,
                  lineHeight: 1.65,
                  maxWidth: 900,
                }}
              >
                {executiveSummary.text}
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  opacity: 0.75,
                  lineHeight: 1.5,
                }}
              >
                Referencia aplicada: Strong ≥ {SUCCESS_SCORE_MIN}% y FAIL ≤{" "}
                {pct(SUCCESS_FAIL_RATE_MAX)} · Needs attention ≥ {WARNING_SCORE_MIN}% y FAIL ≤{" "}
                {pct(WARNING_FAIL_RATE_MAX)} · Fail rate actual: {pct(failRatePct)}
              </div>
            </div>
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2
              className="report-title-lg"
              style={{ margin: "0 0 14px 0", fontSize: 24 }}
            >
              Resultado por secciones
            </h2>

            <div style={{ display: "grid", gap: 12 }}>
              {report.sections.map((section) => (
                <div
                  key={section.section_id}
                  className="report-break-avoid report-card report-section-row"
                  style={sectionCardStyle()}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 20 }}>{section.section_name}</div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span
                        className="report-badge"
                        style={{
                          ...badgeStyle("FAIL"),
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                        }}
                      >
                        FAIL: {section.fail}
                      </span>
                      <span
                        className="report-badge"
                        style={{
                          ...badgeStyle("NA"),
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                        }}
                      >
                        NA: {section.na}
                      </span>
                      <span
                        className="report-badge"
                        style={{
                          ...badgeStyle("OK"),
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                        }}
                      >
                        Pass: {section.ok}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2 className="report-title-lg" style={{ margin: "0 0 10px 0", fontSize: 24 }}>
              Hallazgos críticos
            </h2>

            {failedItems.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                No hay preguntas en FAIL.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {failedItems.map((item, idx) => (
                  <div
                    key={item.question_id}
                    className="report-break-avoid"
                    style={{
                      border: "1px solid rgba(220,38,38,0.15)",
                      borderRadius: 10,
                      background: "rgba(220,38,38,0.03)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            opacity: 0.45,
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            minWidth: 108,
                          }}
                        >
                          {idx + 1}. {item.section_name}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
                          {item.question_text}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        {photoNumberByQuestionId.has(item.question_id) ? (
                          <span
                            className="report-badge"
                            style={{
                              padding: "3px 9px",
                              borderRadius: 999,
                              fontWeight: 900,
                              fontSize: 11,
                              background: "rgba(59,130,246,0.10)",
                              color: "#1d4ed8",
                              border: "1px solid rgba(59,130,246,0.18)",
                            }}
                          >
                            📎 {(photoCountByQuestionId.get(item.question_id) ?? 1) > 1 ? `${photoCountByQuestionId.get(item.question_id)} fotos` : `Foto ${photoNumberByQuestionId.get(item.question_id)}`}
                          </span>
                        ) : null}
                        <span
                          className="report-badge"
                          style={{
                            ...badgeStyle(item.status),
                            padding: "3px 9px",
                            borderRadius: 999,
                            fontWeight: 900,
                            fontSize: 11,
                          }}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {item.comment ? (
                      <div
                        style={{
                          padding: "7px 14px 10px",
                          borderTop: "1px solid rgba(220,38,38,0.10)",
                          fontSize: 13,
                          color: "#7f1d1d",
                          lineHeight: 1.5,
                        }}
                      >
                        {item.comment}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2 className="report-title-lg" style={{ margin: "0 0 10px 0", fontSize: 24 }}>
              Estándares aprobados
            </h2>

            {passedItems.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                No hay ítems en Pass.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {passedItems.map((item) => (
                  <div
                    key={item.question_id}
                    className="report-break-avoid"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(22,163,74,0.15)",
                      background: "rgba(22,163,74,0.03)",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          opacity: 0.45,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          minWidth: 108,
                        }}
                      >
                        {item.section_name}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
                        {item.question_text}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {photoNumberByQuestionId.has(item.question_id) ? (
                        <span
                          className="report-badge"
                          style={{
                            padding: "3px 9px",
                            borderRadius: 999,
                            fontWeight: 900,
                            fontSize: 11,
                            background: "rgba(59,130,246,0.10)",
                            color: "#1d4ed8",
                            border: "1px solid rgba(59,130,246,0.18)",
                          }}
                        >
                          📎 Foto {photoNumberByQuestionId.get(item.question_id)}
                        </span>
                      ) : null}
                      <span
                        className="report-badge"
                        style={{
                          ...badgeStyle("OK"),
                          padding: "3px 9px",
                          borderRadius: 999,
                          fontWeight: 900,
                          fontSize: 11,
                        }}
                      >
                        Pass
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2
              className="report-title-lg"
              style={{ margin: "0 0 14px 0", fontSize: 24 }}
            >
              Timeline
            </h2>

            {report.timeline.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                Sin eventos registrados.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {report.timeline.map((event, idx) => (
                  <div
                    key={`${event.type}-${idx}`}
                    className="report-break-avoid report-card"
                    style={sectionCardStyle()}
                  >
                    <div style={{ fontWeight: 900 }}>{event.label}</div>
                    <div style={{ marginTop: 6, opacity: 0.8 }}>
                      {event.date ? new Date(event.date).toLocaleString("es-ES") : "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {showTrainingSignoff ? (
            <section className="report-mt-28 report-break-avoid" style={{ marginTop: 28 }}>
              <h2
                className="report-title-lg"
                style={{ margin: "0 0 14px 0", fontSize: 24 }}
              >
                Acción formativa y firmas
              </h2>

              <div
                className="report-card"
                style={{
                  ...sectionCardStyle(),
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    opacity: 0.72,
                    marginBottom: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  Registro de formación correctiva
                </div>

                <div>
                  <div style={fieldLabelStyle()}>Acción formativa aplicada</div>
                  <textarea
                    className="editable-training-textarea"
                    value={trainingAction}
                    onChange={(e) => setTrainingAction(e.target.value)}
                    placeholder="Describe aquí la explicación dada, corrección realizada, refuerzo de estándar, demostración práctica u observaciones acordadas con el colaborador."
                    style={editableTextareaStyle()}
                  />
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={fieldLabelStyle()}>Fecha</div>
                    <input
                      className="editable-training-input"
                      type="text"
                      value={trainingDate}
                      onChange={(e) => setTrainingDate(e.target.value)}
                      placeholder="Ej. 09/03/2026"
                      style={editableInputStyle()}
                    />
                  </div>

                  <div>
                    <div style={fieldLabelStyle()}>Nombre del colaborador</div>
                    <input
                      className="editable-training-input"
                      type="text"
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="Nombre del colaborador"
                      style={editableInputStyle()}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    maxWidth: 420,
                  }}
                >
                  <div style={fieldLabelStyle()}>Nombre del supervisor / formador</div>
                  <input
                    className="editable-training-input"
                    type="text"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    placeholder="Nombre del supervisor / formador"
                    style={editableInputStyle()}
                  />
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 18,
                  }}
                >
                  <div
                    className="training-signature-box"
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      padding: 14,
                      minHeight: 120,
                      background: "rgba(0,0,0,0.015)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        borderBottom: "1px solid rgba(0,0,0,0.4)",
                        height: 48,
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                      Firma del colaborador / formado
                    </div>
                  </div>

                  <div
                    className="training-signature-box"
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 14,
                      padding: 14,
                      minHeight: 120,
                      background: "rgba(0,0,0,0.015)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        borderBottom: "1px solid rgba(0,0,0,0.4)",
                        height: 48,
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                      Firma del supervisor / formador
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {photoItems.length > 0 ? (
            <section className="report-mt-28" style={{ marginTop: 28 }}>
              <h2
                className="report-title-lg"
                style={{ margin: "0 0 14px 0", fontSize: 24 }}
              >
                Anexo Fotográfico
              </h2>

              <div
                className="report-photo-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                {photoItems.map((item) => (
                  <div
                    key={item.question_id}
                    className="report-break-avoid report-photo-card"
                    style={{
                      border: "1px solid rgba(0,0,0,0.10)",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#fafafa",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.photo_url!}
                      alt={`Foto ${item.photoNumber}`}
                      style={{
                        width: "100%",
                        display: "block",
                        maxHeight: 260,
                        objectFit: "cover",
                      }}
                    />
                    <div style={{ padding: "10px 12px" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          opacity: 0.5,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          marginBottom: 3,
                        }}
                      >
                        Foto {item.photoNumber} · {item.section_name}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                        {item.question_text}
                      </div>
                      {item.comment ? (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "#555",
                            lineHeight: 1.45,
                          }}
                        >
                          {item.comment}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
