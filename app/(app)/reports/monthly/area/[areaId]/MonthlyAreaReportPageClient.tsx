"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildMonthlyAreaReport } from "@/lib/reports/buildMonthlyAreaReport";
import type { MonthlyAreaReportData } from "@/lib/reports/monthlyReportTypes";

const SUCCESS_SCORE_MIN = 90;
const WARNING_SCORE_MIN = 75;
const SUCCESS_FAIL_RATE_MAX = 5;
const WARNING_FAIL_RATE_MAX = 15;

function isValidMonth(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function getPreviousFullMonthFrom(baseMonth?: string | null) {
  if (isValidMonth(baseMonth)) {
    const [yearStr, monthStr] = baseMonth.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    return {
      month: baseMonth,
      monthStart: start.toISOString().slice(0, 10),
      monthEnd: end.toISOString().slice(0, 10),
    };
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    monthStart: start.toISOString().slice(0, 10),
    monthEnd: end.toISOString().slice(0, 10),
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatScore(value: number | null) {
  if (typeof value !== "number") return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatStatus(value: string | null) {
  return value?.trim() || "—";
}

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
    maxWidth: 1160,
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

function badgeToneStyle(tone: "good" | "warning" | "critical"): CSSProperties {
  if (tone === "good") {
    return {
      background: "rgba(22, 163, 74, 0.10)",
      color: "#15803d",
      border: "1px solid rgba(22, 163, 74, 0.18)",
    };
  }
  if (tone === "critical") {
    return {
      background: "rgba(220, 38, 38, 0.10)",
      color: "#b91c1c",
      border: "1px solid rgba(220, 38, 38, 0.18)",
    };
  }
  return {
    background: "rgba(245, 158, 11, 0.10)",
    color: "#92400e",
    border: "1px solid rgba(245, 158, 11, 0.18)",
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

export default function MonthlyAreaReportPageClient({
  areaId,
  hotelId,
}: {
  areaId: string;
  hotelId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MonthlyAreaReportData | null>(null);

  const effectiveMonth = useMemo(() => getPreviousFullMonthFrom(monthParam), [monthParam]);

  useEffect(() => {
    if (!areaId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await buildMonthlyAreaReport({
          areaId,
          hotelId,
          month: effectiveMonth.month,
        });

        setReport(data);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Error generando el reporte mensual del área.");
        setLoading(false);
      }
    })();
  }, [areaId, effectiveMonth.month, hotelId]);

  const monthlySummary = useMemo(() => {
    if (!report) {
      return { label: "", tone: "warning" as const, text: "" };
    }

    const score = report.summary.avg_score;
    const failRate = report.summary.fail_rate_pct;

    const weakestSections = [...report.sections]
      .filter((s) => s.fail > 0)
      .sort((a, b) => b.fail - a.fail)
      .slice(0, 2)
      .map((s) => s.section_name);

    const focusAreas =
      weakestSections.length === 0
        ? ""
        : weakestSections.length === 1
        ? weakestSections[0]
        : `${weakestSections[0]} y ${weakestSections[1]}`;

    const strong =
      typeof score === "number" &&
      score >= SUCCESS_SCORE_MIN &&
      failRate <= SUCCESS_FAIL_RATE_MAX;

    const warning =
      typeof score === "number" &&
      score >= WARNING_SCORE_MIN &&
      failRate <= WARNING_FAIL_RATE_MAX;

    if (report.summary.audit_count === 0) {
      return {
        label: "Sin actividad",
        tone: "warning" as const,
        text:
          "No se registraron auditorías en esta área durante el mes seleccionado. Conviene revisar si hubo planificación insuficiente o si la ejecución quedó pendiente.",
      };
    }

    if (strong) {
      return {
        label: "Mes sólido",
        tone: "good" as const,
        text: focusAreas
          ? `El área mantuvo un mes sólido, dentro de los umbrales esperados. Las incidencias detectadas fueron puntuales y se concentraron principalmente en ${focusAreas}.`
          : "El área mantuvo un mes sólido, dentro de los umbrales esperados, sin señales de desviación relevantes.",
      };
    }

    if (warning) {
      return {
        label: "Atención requerida",
        tone: "warning" as const,
        text: focusAreas
          ? `El área cerró el mes en una zona de atención. Los principales focos se concentraron en ${focusAreas}, por lo que conviene dar seguimiento en el siguiente ciclo.`
          : "El área cerró el mes en una zona de atención. Conviene revisar los hallazgos detectados y dar seguimiento en el siguiente ciclo de auditorías.",
      };
    }

    return {
      label: "Acción prioritaria",
      tone: "critical" as const,
      text: focusAreas
        ? `El área cerró el mes por debajo del umbral esperado. Los principales hallazgos se concentraron en ${focusAreas}, por lo que se recomienda acción correctiva prioritaria.`
        : "El área cerró el mes por debajo del umbral esperado. Se recomienda acción correctiva prioritaria y seguimiento específico de los hallazgos detectados.",
    };
  }, [report]);

  if (loading) {
    return (
      <main style={pageStyle()}>
        <div style={paperStyle()}>
          <div style={{ padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 38 }}>Reporte mensual del área</h1>
            <p style={{ marginTop: 10 }}>Cargando reporte mensual…</p>
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
            <h1 style={{ margin: 0, fontSize: 38 }}>Reporte mensual del área</h1>
            <p style={{ marginTop: 10, color: "crimson", fontWeight: 800 }}>
              {error ?? "No se pudo generar el reporte mensual."}
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
            <div style={{ fontSize: 13, opacity: 0.55 }}>Vista imprimible mensual por área</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => window.print()} style={btnStyle(true)}>
              Imprimir / PDF
            </button>
            <button onClick={() => router.push(`/areas/${report.area.id}`)} style={btnStyle(false)}>
              Ver área
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
                Reporte mensual del área
              </div>

              <h1 className="report-title-xl" style={{ margin: 0, fontSize: 40, lineHeight: 1.05 }}>
                {report.area.name}
              </h1>

              <div style={{ marginTop: 14, lineHeight: 1.7 }}>
                <div>
                  <strong>Hotel:</strong> {report.hotel.name}
                </div>
                <div>
                  <strong>Área:</strong> {report.area.name}
                  {report.area.type ? ` (${report.area.type})` : ""}
                </div>
                <div>
                  <strong>Mes:</strong> {report.range.label}
                </div>
                <div>
                  <strong>Rango:</strong> {report.range.month_start} al {report.range.month_end}
                </div>
                <div>
                  <strong>Auditorías:</strong> {report.summary.audit_count}
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
                Score medio mensual
              </div>
              <div
                className="report-score-value"
                style={{ fontSize: 46, fontWeight: 900, lineHeight: 1, marginTop: 10 }}
              >
                {formatScore(report.summary.avg_score)}
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
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>Auditorías</div>
              <div className="report-kpi-value" style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
                {report.summary.audit_count}
              </div>
            </div>

            <div className="report-card" style={kpiStyle()}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>Score promedio</div>
              <div className="report-kpi-value" style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
                {formatScore(report.summary.avg_score)}
              </div>
            </div>

            <div className="report-card" style={kpiStyle()}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>Fail rate</div>
              <div className="report-kpi-value" style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>
                {formatPct(report.summary.fail_rate_pct)}
              </div>
            </div>

            <div className="report-card" style={kpiStyle()}>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>Rango</div>
              <div style={{ fontSize: 16, fontWeight: 900, marginTop: 10, lineHeight: 1.35 }}>
                {report.range.month_start}
                <br />
                {report.range.month_end}
              </div>
            </div>
          </section>

          <section className="report-break-avoid report-mt-24" style={{ marginTop: 24 }}>
            <div
              className="report-card"
              style={{
                ...sectionCardStyle(),
                ...summaryToneStyle(monthlySummary.tone),
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
                  style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}
                >
                  Resumen ejecutivo
                </div>

                <span
                  className="report-badge"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    ...badgeToneStyle(monthlySummary.tone),
                  }}
                >
                  {monthlySummary.label}
                </span>
              </div>

              <div style={{ fontSize: 15, lineHeight: 1.65, maxWidth: 900 }}>
                {monthlySummary.text}
              </div>
            </div>
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2 className="report-title-lg" style={{ margin: "0 0 14px 0", fontSize: 24 }}>
              Hallazgos más repetidos
            </h2>

            {report.top_failures.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                No hubo hallazgos repetidos en FAIL durante este mes.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {report.top_failures.map((failure, idx) => (
                  <div
                    key={failure.question_id}
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
                        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.55, marginBottom: 6 }}>
                          {failure.section_name}
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 17 }}>
                          {idx + 1}. {failure.question_text}
                        </div>
                      </div>

                      <span
                        className="report-badge"
                        style={{
                          ...badgeStyle("FAIL"),
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                        }}
                      >
                        FAIL: {failure.fail_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2 className="report-title-lg" style={{ margin: "0 0 14px 0", fontSize: 24 }}>
              Desempeño por secciones
            </h2>

            {report.sections.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                No hay datos de secciones para este mes.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {report.sections.map((section) => (
                  <div
                    key={section.section_id}
                    className="report-break-avoid report-card"
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
                          style={{ ...badgeStyle("FAIL"), padding: "5px 10px", borderRadius: 999, fontWeight: 900 }}
                        >
                          FAIL: {section.fail}
                        </span>
                        <span
                          className="report-badge"
                          style={{ ...badgeStyle("NA"), padding: "5px 10px", borderRadius: 999, fontWeight: 900 }}
                        >
                          NA: {section.na}
                        </span>
                        <span
                          className="report-badge"
                          style={{ ...badgeStyle("OK"), padding: "5px 10px", borderRadius: 999, fontWeight: 900 }}
                        >
                          OK: {section.ok}
                        </span>
                        <span
                          className="report-badge"
                          style={{
                            padding: "5px 10px",
                            borderRadius: 999,
                            fontWeight: 900,
                            background: "rgba(0,0,0,0.04)",
                            color: "#111",
                            border: "1px solid rgba(0,0,0,0.08)",
                          }}
                        >
                          Total: {section.total}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2 className="report-title-lg" style={{ margin: "0 0 14px 0", fontSize: 24 }}>
              Auditorías del mes
            </h2>

            {report.audits.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                No hubo auditorías registradas en este mes.
              </div>
            ) : (
              <div className="report-card" style={{ ...sectionCardStyle(), padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                        {["Fecha", "Auditor", "Template", "Score", "Estado", "FAIL", "NA", "OK"].map((head) => (
                          <th
                            key={head}
                            style={{
                              textAlign: "left",
                              padding: "12px 14px",
                              fontSize: 12,
                              fontWeight: 900,
                              opacity: 0.75,
                              borderBottom: "1px solid rgba(0,0,0,0.08)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.audits.map((audit) => (
                        <tr key={audit.run_id}>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {formatDateTime(audit.executed_at)}
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {audit.auditor_name ?? "—"}
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 800 }}>
                            {audit.template_name}
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 900 }}>
                            {formatScore(audit.score)}
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {formatStatus(audit.status)}
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "#b91c1c", fontWeight: 900 }}>
                            {audit.fail}
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "#374151", fontWeight: 900 }}>
                            {audit.na}
                          </td>
                          <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "#15803d", fontWeight: 900 }}>
                            {audit.ok}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
