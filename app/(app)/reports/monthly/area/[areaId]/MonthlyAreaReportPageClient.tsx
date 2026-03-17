"use client";

import AreaPeriodReportPage, {
  formatDateTime,
  formatScore,
} from "@/app/(app)/reports/_components/AreaPeriodReportPage";
import type { MonthlyAreaReportData } from "@/lib/reports/monthlyReportTypes";

const SUCCESS_SCORE_MIN = 90;
const WARNING_SCORE_MIN = 75;
const SUCCESS_FAIL_RATE_MAX = 5;
const WARNING_FAIL_RATE_MAX = 15;

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatStatus(value: string | null) {
  return value?.trim() || "—";
}

export default function MonthlyAreaReportPageClient({ report }: { report: MonthlyAreaReportData }) {
  const score = report.summary.avg_score;
  const failRate = report.summary.fail_rate_pct;

  const weakestSections = [...report.sections]
    .filter((section) => section.fail > 0)
    .sort((a, b) => b.fail - a.fail)
    .slice(0, 2)
    .map((section) => section.section_name);

  const focusAreas =
    weakestSections.length === 0
      ? ""
      : weakestSections.length === 1
      ? weakestSections[0]
      : `${weakestSections[0]} y ${weakestSections[1]}`;

  const strong =
    typeof score === "number" && score >= SUCCESS_SCORE_MIN && failRate <= SUCCESS_FAIL_RATE_MAX;

  const warning =
    typeof score === "number" && score >= WARNING_SCORE_MIN && failRate <= WARNING_FAIL_RATE_MAX;

  const summary =
    report.summary.audit_count === 0
      ? {
          label: "Sin actividad",
          tone: "warning" as const,
          text: "No se registraron auditorías en esta área durante el mes seleccionado. Conviene revisar si hubo planificación insuficiente o si la ejecución quedó pendiente.",
        }
      : strong
      ? {
          label: "Mes sólido",
          tone: "good" as const,
          text: focusAreas
            ? `El área mantuvo un mes sólido, dentro de los umbrales esperados. Las incidencias detectadas fueron puntuales y se concentraron principalmente en ${focusAreas}.`
            : "El área mantuvo un mes sólido, dentro de los umbrales esperados, sin señales de desviación relevantes.",
        }
      : warning
      ? {
          label: "Atención requerida",
          tone: "warning" as const,
          text: focusAreas
            ? `El área cerró el mes en una zona de atención. Los principales focos se concentraron en ${focusAreas}, por lo que conviene dar seguimiento en el siguiente ciclo.`
            : "El área cerró el mes en una zona de atención. Conviene revisar los hallazgos detectados y dar seguimiento en el siguiente ciclo de auditorías.",
        }
      : {
          label: "Acción prioritaria",
          tone: "critical" as const,
          text: focusAreas
            ? `El área cerró el mes por debajo del umbral esperado. Los principales hallazgos se concentraron en ${focusAreas}, por lo que se recomienda acción correctiva prioritaria.`
            : "El área cerró el mes por debajo del umbral esperado. Se recomienda acción correctiva prioritaria y seguimiento específico de los hallazgos detectados.",
        };

  return (
    <AreaPeriodReportPage
      report={report}
      copy={{
        shellSubtitle: "Vista imprimible mensual por área",
        eyebrow: "Reporte mensual del área",
        periodLabel: "Mes",
        scoreLabel: "Score medio mensual",
        summaryTitle: "Resumen ejecutivo",
        topFailuresTitle: "Hallazgos más repetidos",
        sectionsTitle: "Desempeño por secciones",
        auditsTitle: "Auditorías del mes",
        emptyTopFailures: "No hubo hallazgos repetidos en FAIL durante este mes.",
        emptySections: "No hay datos de secciones para este mes.",
        emptyAudits: "No hubo auditorías registradas en este mes.",
      }}
      summary={summary}
      rangeRows={[
        {
          label: "Rango",
          value: `${report.range.month_start} al ${report.range.month_end}`,
        },
      ]}
      kpis={[
        { label: "Auditorías", value: String(report.summary.audit_count) },
        { label: "Score promedio", value: formatScore(report.summary.avg_score) },
        { label: "Fail rate", value: formatPct(report.summary.fail_rate_pct) },
        {
          label: "Rango",
          value: `${report.range.month_start} - ${report.range.month_end}`,
        },
      ]}
      auditColumns={[
        {
          key: "date",
          label: "Fecha",
          render: (audit) => formatDateTime(audit.executed_at),
        },
        {
          key: "auditor",
          label: "Auditor",
          render: (audit) => audit.auditor_name ?? "—",
        },
        {
          key: "template",
          label: "Template",
          render: (audit) => <span style={{ fontWeight: 800 }}>{audit.template_name}</span>,
        },
        {
          key: "score",
          label: "Score",
          render: (audit) => <span style={{ fontWeight: 900 }}>{formatScore(audit.score)}</span>,
        },
        {
          key: "status",
          label: "Estado",
          render: (audit) => formatStatus(audit.status),
        },
        {
          key: "fail",
          label: "FAIL",
          render: (audit) => audit.fail,
          tone: "fail",
        },
        {
          key: "na",
          label: "NA",
          render: (audit) => audit.na,
          tone: "na",
        },
        {
          key: "ok",
          label: "OK",
          render: (audit) => audit.ok,
          tone: "ok",
        },
      ]}
    />
  );
}
