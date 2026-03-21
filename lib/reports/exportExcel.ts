import * as XLSX from "xlsx";
import type { AuditReportData } from "@/lib/reports/auditReportTypes";
import type { AreaPeriodReportData } from "@/lib/reports/areaPeriodReportTypes";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "").trim().replace(/\s+/g, "_");
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAuditReportToExcel(data: AuditReportData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumenRows = [
    ["Campo", "Valor"],
    ["Área", data.area?.name ?? ""],
    ["Template", data.template?.name ?? ""],
    ["Puntuación", data.run.score ?? ""],
    ["Estado", data.run.status ?? ""],
    ["Habitación", data.run.room_number ?? ""],
    ["Fecha", data.run.executed_at ?? ""],
    ["Total preguntas", data.summary.total],
    ["OK", data.summary.ok],
    ["FAIL", data.summary.fail],
    ["N/A", data.summary.na],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Sheet 2: Detalle
  const detalleHeader = ["Sección", "Pregunta", "Resultado", "Comentario"];
  const detalleRows: (string | null)[][] = data.sections.flatMap((section) =>
    section.items.map((item) => [
      section.section_name,
      item.question_text,
      item.status,
      item.comment ?? "",
    ])
  );
  const wsDetalle = XLSX.utils.aoa_to_sheet([detalleHeader, ...detalleRows]);
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");

  const areaName = sanitizeFilename(data.area?.name ?? "sin-area");
  const date = sanitizeFilename(data.run.executed_at?.slice(0, 10) ?? "sin-fecha");
  const filename = `Auditoria_${areaName}_${date}.xlsx`;

  downloadWorkbook(wb, filename);
}

export function exportAreaPeriodReportToExcel(data: AreaPeriodReportData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumenRows = [
    ["Campo", "Valor"],
    ["Hotel", data.hotel.name],
    ["Área", data.area.name],
    ["Periodo", data.range.label],
    ["Auditorías", data.summary.audit_count],
    ["Puntuación media", data.summary.avg_score ?? ""],
    ["Tasa de fallos %", data.summary.fail_rate_pct],
    ["Total respuestas", data.summary.total_answers],
    ["OK", data.summary.ok_count],
    ["FAIL", data.summary.fail_count],
    ["N/A", data.summary.na_count],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Sheet 2: Auditorías
  const auditHeader = ["Fecha", "Template", "Auditor", "Puntuación", "OK", "FAIL", "N/A", "Total"];
  const auditRows = data.audits.map((audit) => [
    audit.executed_at ?? "",
    audit.template_name,
    audit.auditor_name ?? "",
    audit.score ?? "",
    audit.ok,
    audit.fail,
    audit.na,
    audit.total,
  ]);
  const wsAudits = XLSX.utils.aoa_to_sheet([auditHeader, ...auditRows]);
  XLSX.utils.book_append_sheet(wb, wsAudits, "Auditorías");

  // Sheet 3: Fallos frecuentes
  const fallosHeader = ["Pregunta", "Sección", "Nº fallos"];
  const fallosRows = data.top_failures.map((f) => [f.question_text, f.section_name, f.fail_count]);
  const wsFallos = XLSX.utils.aoa_to_sheet([fallosHeader, ...fallosRows]);
  XLSX.utils.book_append_sheet(wb, wsFallos, "Fallos frecuentes");

  const areaName = sanitizeFilename(data.area.name);
  const rangeLabel = sanitizeFilename(data.range.label);
  const filename = `Reporte_${areaName}_${rangeLabel}.xlsx`;

  downloadWorkbook(wb, filename);
}
