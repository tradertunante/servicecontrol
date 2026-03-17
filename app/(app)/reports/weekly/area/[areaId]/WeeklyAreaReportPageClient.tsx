"use client";

import AreaPeriodReportPage, {
  formatDateTime,
  formatScore,
} from "@/app/(app)/reports/_components/AreaPeriodReportPage";
import type { WeeklyAreaReportData } from "@/lib/reports/weeklyReportTypes";

const SUCCESS_SCORE_MIN = 90;
const WARNING_SCORE_MIN = 75;
const SUCCESS_FAIL_RATE_MAX = 5;
const WARNING_FAIL_RATE_MAX = 15;

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function WeeklyAreaReportPageClient({ report }: { report: WeeklyAreaReportData }) {
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
          text: "No se registraron auditorías en esta área durante la semana seleccionada. Conviene revisar si hubo planificación insuficiente o si la ejecución quedó pendiente.",
        }
      : strong
      ? {
          label: "Semana sólida",
          tone: "good" as const,
          text: focusAreas
            ? `El área mantuvo una semana sólida, dentro de los umbrales esperados. Las incidencias detectadas fueron puntuales y se concentraron principalmente en ${focusAreas}.`
            : "El área mantuvo una semana sólida, dentro de los umbrales esperados, sin señales de desviación relevantes.",
        }
      : warning
      ? {
          label: "Atención requerida",
          tone: "warning" as const,
          text: focusAreas
            ? `El área cerró la semana en una zona de atención. Los principales focos se concentraron en ${focusAreas}, por lo que conviene dar seguimiento en la siguiente revisión.`
            : "El área cerró la semana en una zona de atención. Conviene revisar los hallazgos detectados y dar seguimiento en la siguiente ronda de auditorías.",
        }
      : {
          label: "Acción prioritaria",
          tone: "critical" as const,
          text: focusAreas
            ? `El área cerró la semana por debajo del umbral esperado. Los principales hallazgos se concentraron en ${focusAreas}, por lo que se recomienda acción correctiva prioritaria.`
            : "El área cerró la semana por debajo del umbral esperado. Se recomienda acción correctiva prioritaria y seguimiento específico de los hallazgos detectados.",
        };

  return (
    <AreaPeriodReportPage
      report={report}
      copy={{
        shellSubtitle: "Vista imprimible semanal por área",
        eyebrow: "Reporte semanal del área",
        periodLabel: "Semana",
        scoreLabel: "Score medio semanal",
        summaryTitle: "Resumen ejecutivo",
        topFailuresTitle: "Hallazgos más repetidos",
        sectionsTitle: "Desempeño por secciones",
        auditsTitle: "Auditorías de la semana",
        emptyTopFailures: "No hubo hallazgos repetidos en FAIL durante esta semana.",
        emptySections: "No hay datos de secciones para esta semana.",
        emptyAudits: "No hubo auditorías registradas en esta semana.",
      }}
      summary={summary}
      kpis={[
        { label: "Fail rate", value: formatPct(report.summary.fail_rate_pct) },
        { label: "FAIL totales", value: String(report.summary.fail_count), tone: "fail" },
        { label: "OK totales", value: String(report.summary.ok_count), tone: "ok" },
      ]}
      auditColumns={[
        {
          key: "date",
          label: "Fecha",
          render: (audit) => formatDateTime(audit.executed_at),
        },
        {
          key: "template",
          label: "Template",
          render: (audit) => <span style={{ fontWeight: 800 }}>{audit.template_name}</span>,
        },
        {
          key: "auditor",
          label: "Auditor",
          render: (audit) => audit.auditor_name ?? "—",
        },
        {
          key: "score",
          label: "Score",
          render: (audit) => <span style={{ fontWeight: 900 }}>{formatScore(audit.score)}</span>,
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
