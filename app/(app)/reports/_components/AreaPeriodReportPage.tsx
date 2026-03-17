"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type {
  AreaPeriodAuditRow,
  AreaPeriodSectionRow,
  AreaPeriodTopFailureRow,
} from "@/lib/reports/areaPeriodReportTypes";

type Tone = "good" | "warning" | "critical";

type SummaryContent = {
  label: string;
  tone: Tone;
  text: string;
};

type ReportData = {
  hotel: {
    id: string | null;
    name: string;
  };
  area: {
    id: string;
    name: string;
    type: string | null;
  };
  range: {
    label: string;
  } & Record<string, string>;
  summary: {
    audit_count: number;
    avg_score: number | null;
    fail_rate_pct: number;
    fail_count: number;
    na_count: number;
    ok_count: number;
    total_answers: number;
  };
  audits: AreaPeriodAuditRow[];
  top_failures: AreaPeriodTopFailureRow[];
  sections: AreaPeriodSectionRow[];
};

type KpiCard = {
  label: string;
  value: string;
  tone?: "default" | "fail" | "ok";
};

type AuditColumn = {
  key: string;
  label: string;
  render: (audit: AreaPeriodAuditRow) => React.ReactNode;
  tone?: "default" | "fail" | "na" | "ok";
};

type ReportCopy = {
  shellSubtitle: string;
  eyebrow: string;
  periodLabel: string;
  scoreLabel: string;
  summaryTitle: string;
  topFailuresTitle: string;
  sectionsTitle: string;
  auditsTitle: string;
  emptyTopFailures: string;
  emptySections: string;
  emptyAudits: string;
};

export type AreaPeriodReportPageProps = {
  report: ReportData;
  copy: ReportCopy;
  summary: SummaryContent;
  kpis: KpiCard[];
  auditColumns: AuditColumn[];
  rangeRows?: Array<{
    label: string;
    value: string;
  }>;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatScore(value: number | null) {
  if (typeof value !== "number") return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
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

function badgeToneStyle(tone: Tone): CSSProperties {
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
  if (status === "FAIL") return badgeToneStyle("critical");
  if (status === "NA") {
    return {
      background: "rgba(55, 65, 81, 0.10)",
      color: "#374151",
      border: "1px solid rgba(55, 65, 81, 0.18)",
    };
  }
  return badgeToneStyle("good");
}

function summaryToneStyle(tone: Tone): CSSProperties {
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

function cellToneStyle(tone?: AuditColumn["tone"]): CSSProperties | undefined {
  if (tone === "fail") return { color: "#b91c1c", fontWeight: 900 };
  if (tone === "na") return { color: "#374151", fontWeight: 900 };
  if (tone === "ok") return { color: "#15803d", fontWeight: 900 };
  return undefined;
}

function kpiValueTone(tone?: KpiCard["tone"]): CSSProperties | undefined {
  if (tone === "fail") return { color: "#b91c1c" };
  if (tone === "ok") return { color: "#15803d" };
  return undefined;
}

function renderPrintStyles(kpiCount: number) {
  return `
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
        grid-template-columns: repeat(${kpiCount}, 1fr) !important;
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
  `;
}

export default function AreaPeriodReportPage({
  report,
  copy,
  summary,
  kpis,
  auditColumns,
  rangeRows = [],
}: AreaPeriodReportPageProps) {
  const router = useRouter();

  return (
    <main style={pageStyle()}>
      <style jsx global>{renderPrintStyles(kpis.length)}</style>

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
            <div style={{ fontSize: 13, opacity: 0.55 }}>{copy.shellSubtitle}</div>
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
                {copy.eyebrow}
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
                  <strong>{copy.periodLabel}:</strong> {report.range.label}
                </div>
                {rangeRows.map((row) => (
                  <div key={row.label}>
                    <strong>{row.label}:</strong> {row.value}
                  </div>
                ))}
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
                {copy.scoreLabel}
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
              gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))`,
              gap: 12,
            }}
          >
            {kpis.map((kpi) => (
              <div key={kpi.label} className="report-card" style={kpiStyle()}>
                <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>{kpi.label}</div>
                <div
                  className="report-kpi-value"
                  style={{ fontSize: 28, fontWeight: 900, marginTop: 6, ...kpiValueTone(kpi.tone) }}
                >
                  {kpi.value}
                </div>
              </div>
            ))}
          </section>

          <section className="report-break-avoid report-mt-24" style={{ marginTop: 24 }}>
            <div
              className="report-card"
              style={{
                ...sectionCardStyle(),
                ...summaryToneStyle(summary.tone),
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
                  {copy.summaryTitle}
                </div>

                <span
                  className="report-badge"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    ...badgeToneStyle(summary.tone),
                  }}
                >
                  {summary.label}
                </span>
              </div>

              <div style={{ fontSize: 15, lineHeight: 1.65, maxWidth: 900 }}>{summary.text}</div>
            </div>
          </section>

          <section className="report-mt-28" style={{ marginTop: 28 }}>
            <h2 className="report-title-lg" style={{ margin: "0 0 14px 0", fontSize: 24 }}>
              {copy.topFailuresTitle}
            </h2>

            {report.top_failures.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                {copy.emptyTopFailures}
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
              {copy.sectionsTitle}
            </h2>

            {report.sections.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                {copy.emptySections}
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
              {copy.auditsTitle}
            </h2>

            {report.audits.length === 0 ? (
              <div className="report-card" style={sectionCardStyle()}>
                {copy.emptyAudits}
              </div>
            ) : (
              <div className="report-card" style={{ ...sectionCardStyle(), padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                        {auditColumns.map((column) => (
                          <th
                            key={column.key}
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
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.audits.map((audit) => (
                        <tr key={audit.run_id}>
                          {auditColumns.map((column) => (
                            <td
                              key={column.key}
                              style={{
                                padding: "12px 14px",
                                borderBottom: "1px solid rgba(0,0,0,0.06)",
                                ...(cellToneStyle(column.tone) ?? {}),
                              }}
                            >
                              {column.render(audit)}
                            </td>
                          ))}
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

export { formatDateTime, formatScore };
