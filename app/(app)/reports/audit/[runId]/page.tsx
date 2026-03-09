"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/RequireRole";
import { canRunAudits } from "@/lib/auth/permissions";
import { buildAuditReportData } from "@/lib/reports/auditReport";
import type { AuditReportData } from "@/lib/reports/auditReportTypes";

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
    overflow: "hidden",
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

export default function AuditReportPage() {
  const router = useRouter();
  const params = useParams<{ runId: string }>();
  const runId = params?.runId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReportData | null>(null);

  const [trainingAction, setTrainingAction] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [trainerName, setTrainerName] = useState("");

  useEffect(() => {
    if (!runId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const profile = await requireRoleOrRedirect(
          router,
          ["admin", "manager", "auditor"],
          "/areas"
        );
        if (!profile) return;

        if (!canRunAudits(profile.role)) {
          setError("No tienes permisos para ver este reporte.");
          setLoading(false);
          return;
        }

        const data = await buildAuditReportData(runId);
        setReport(data);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error generando el reporte.");
        setLoading(false);
      }
    })();
  }, [runId, router]);

  const failedItems = useMemo(() => {
    return (report?.sections ?? []).flatMap((section) =>
      section.items.filter((item) => item.status === "FAIL")
    );
  }, [report]);

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

  if (loading) {
    return (
      <main style={pageStyle()}>
        <div style={paperStyle()}>
          <div style={{ padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 38 }}>Audit Report</h1>
            <p style={{ marginTop: 10 }}>Cargando reporte…</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main style={pageStyle()}>
        <div style={paperStyle()}>
          <div style={{ padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 38 }}>Audit Report</h1>
            <p style={{ marginTop: 10, color: "crimson", fontWeight: 800 }}>
              {error ?? "No se pudo generar el reporte."}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button onClick={() => router.back()} style={btnStyle(false)}>
                Volver
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const scoreLabel =
    typeof report.run.score === "number"
      ? `${Number.isInteger(report.run.score) ? report.run.score : report.run.score.toFixed(1)}%`
      : "-";

  return (
    <main style={pageStyle()}>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            font-size: 11px !important;
            line-height: 1.35 !important;
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
            gap: 12px !important;
            align-items: start !important;
          }

          .report-kpi-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
          }

          .report-section-row {
            padding: 10px 12px !important;
            border-radius: 10px !important;
          }

          .report-card {
            padding: 10px 12px !important;
            border-radius: 10px !important;
          }

          .report-title-xl {
            font-size: 24px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
          }

          .report-title-lg {
            font-size: 18px !important;
            line-height: 1.15 !important;
            margin: 0 0 8px 0 !important;
          }

          .report-score-box {
            padding: 14px !important;
            border-radius: 12px !important;
          }

          .report-score-value {
            font-size: 34px !important;
            line-height: 1 !important;
            margin-top: 6px !important;
          }

          .report-kpi-value {
            font-size: 22px !important;
            line-height: 1 !important;
            margin-top: 4px !important;
          }

          .report-body-padding {
            padding: 16px !important;
          }

          .report-mt-24 {
            margin-top: 16px !important;
          }

          .report-mt-28 {
            margin-top: 18px !important;
          }

          .report-badge {
            padding: 3px 8px !important;
            border-radius: 999px !important;
            font-size: 10px !important;
            font-weight: 900 !important;
          }

          .training-signature-box {
            min-height: 110px !important;
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
            min-height: 120px !important;
            resize: none !important;
          }
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => window.print()} style={btnStyle(true)}>
              Imprimir / PDF
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
                style={{ margin: 0, fontSize: 40, lineHeight: 1.05 }}
              >
                {report.template?.name ?? "Auditoría"}
              </h1>

              <div style={{ marginTop: 14, lineHeight: 1.7 }}>
                <div>
                  <strong>Área:</strong> {report.area?.name ?? report.run.area_id}{" "}
                  {report.area?.type ? `(${report.area.type})` : ""}
                </div>
                <div>
                  <strong>Estado:</strong> {report.run.status ?? "-"}
                </div>
                <div>
                  <strong>Ejecutada:</strong>{" "}
                  {report.run.executed_at
                    ? new Date(report.run.executed_at).toLocaleString()
                    : "No ejecutada"}
                </div>
                <div>
                  <strong>Run ID:</strong> {report.run.id}
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
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>OK</div>
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
                        OK: {section.ok}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2
              className="report-title-lg"
              style={{ margin: "0 0 14px 0", fontSize: 24 }}
            >
              Hallazgos críticos
            </h2>

            {failedItems.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                No hay preguntas en FAIL.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {failedItems.map((item, idx) => (
                  <div
                    key={item.question_id}
                    className="report-break-avoid report-card"
                    style={sectionCardStyle()}
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
                      <div style={{ flex: "1 1 600px" }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            opacity: 0.55,
                            marginBottom: 6,
                          }}
                        >
                          {item.section_name}
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 17 }}>
                          {idx + 1}. {item.question_text}
                        </div>
                      </div>

                      <span
                        className="report-badge"
                        style={{
                          ...badgeStyle(item.status),
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.03)",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>Comentario:</strong> {item.comment ?? "Sin comentario."}
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
                      {event.date ? new Date(event.date).toLocaleString() : "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}