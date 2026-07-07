"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchActiveHotel, setActiveHotel } from "@/lib/auth/activeHotelClient";
import { parseHistoricalImportRows } from "@/lib/superadmin/historicalImportExcel";
import { fetchJsonOrThrow } from "@/lib/superadmin/clientApi";
import type {
  HistoricalImportHotelOption,
  HistoricalImportPreviewRow,
  HistoricalImportQuestionReference,
  HistoricalImportResult,
  HistoricalImportSelectedTemplate,
  HistoricalImportTemplateOption,
} from "@/lib/superadmin/historicalImportShared";

function cardStyle() {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    display: "grid",
    gap: 12,
  } as const;
}

function inputStyle() {
  return {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    width: "100%",
    background: "#fff",
  } as const;
}

function primaryButtonStyle(disabled = false) {
  return {
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "#111827",
    color: disabled ? "#9ca3af" : "#fff",
    padding: "10px 12px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  } as const;
}

function secondaryButtonStyle(disabled = false) {
  return {
    border: "1px solid #d1d5db",
    background: "#fff",
    color: disabled ? "#9ca3af" : "#111827",
    padding: "10px 12px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  } as const;
}

function normalizeError(message: string | null | undefined, fallback: string) {
  const safe = String(message ?? "").trim();
  return safe || fallback;
}

type ContextResponse = {
  hotels: HistoricalImportHotelOption[];
  templates: HistoricalImportTemplateOption[];
  selected_hotel: {
    id: string;
    name: string;
  } | null;
  selected_template: HistoricalImportSelectedTemplate | null;
  question_references: HistoricalImportQuestionReference[];
};

export default function HistoricalImportClient({
  hotels,
  initialHotelId,
  initialTemplateId,
}: {
  hotels: HistoricalImportHotelOption[];
  initialHotelId: string;
  initialTemplateId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<HistoricalImportTemplateOption[]>([]);
  const [selectedHotel, setSelectedHotel] = useState(initialHotelId);
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplateId);
  const [templateMeta, setTemplateMeta] = useState<HistoricalImportSelectedTemplate | null>(null);
  const [questionReferences, setQuestionReferences] = useState<HistoricalImportQuestionReference[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<HistoricalImportPreviewRow[]>([]);
  const [result, setResult] = useState<HistoricalImportResult | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const activeHotel = await fetchActiveHotel().catch(() => null);
        const resolvedHotelId = initialHotelId || activeHotel?.hotel_id || "";
        if (!active) return;

        if (!resolvedHotelId) {
          setLoading(false);
          return;
        }

        setSelectedHotel(resolvedHotelId);
        const nextTemplates = await fetchJsonOrThrow<ContextResponse>(
          `/api/superadmin/historical-import?hotel_id=${encodeURIComponent(resolvedHotelId)}`,
          { method: "GET" },
        );
        if (!active) return;
        setTemplates(nextTemplates.templates);

        if (!initialTemplateId) {
          setLoading(false);
          return;
        }

        const context = await fetchJsonOrThrow<ContextResponse>(
          `/api/superadmin/historical-import?hotel_id=${encodeURIComponent(resolvedHotelId)}&template_id=${encodeURIComponent(initialTemplateId)}`,
          { method: "GET" },
        );
        if (!active) return;
        if (context.selected_template) {
          setSelectedTemplate(context.selected_template.id);
          setTemplateMeta(context.selected_template);
        }
        setQuestionReferences(context.question_references);
      } catch (loadError) {
        if (!active) return;
        setError(normalizeError(loadError instanceof Error ? loadError.message : null, "No se pudo cargar la herramienta."));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [initialHotelId, initialTemplateId]);

  const ready = Boolean(selectedHotel && selectedTemplate && templateMeta);
  const previewSummary = useMemo(
    () => ({
      rows: previewRows.length,
      shown: Math.min(previewRows.length, 8),
    }),
    [previewRows],
  );

  async function handleHotelChange(hotelId: string) {
    setSelectedHotel(hotelId);
    setSelectedTemplate("");
    setTemplateMeta(null);
    setQuestionReferences([]);
    setSelectedFile(null);
    setPreviewRows([]);
    setResult(null);
    setError(null);

    if (!hotelId) {
      setTemplates([]);
      return;
    }

    try {
      await setActiveHotel(hotelId);
      const context = await fetchJsonOrThrow<ContextResponse>(
        `/api/superadmin/historical-import?hotel_id=${encodeURIComponent(hotelId)}`,
        { method: "GET" },
      );
      setTemplates(context.templates);
    } catch (loadError) {
      setError(normalizeError(loadError instanceof Error ? loadError.message : null, "No se pudieron cargar los templates."));
    }
  }

  async function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    setTemplateMeta(null);
    setQuestionReferences([]);
    setSelectedFile(null);
    setPreviewRows([]);
    setResult(null);
    setError(null);

    if (!selectedHotel || !templateId) return;

    try {
      const context = await fetchJsonOrThrow<ContextResponse>(
        `/api/superadmin/historical-import?hotel_id=${encodeURIComponent(selectedHotel)}&template_id=${encodeURIComponent(templateId)}`,
        { method: "GET" },
      );
      setTemplateMeta(context.selected_template);
      setQuestionReferences(context.question_references);
    } catch (loadError) {
      setError(normalizeError(loadError instanceof Error ? loadError.message : null, "No se pudo cargar el template seleccionado."));
    }
  }

  async function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setPreviewRows([]);
    setResult(null);
    setError(null);

    if (!file || !templateMeta) return;

    try {
      setLoadingPreview(true);
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("El archivo no contiene hojas.");

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
        raw: false,
      });

      const parsed = parseHistoricalImportRows(rawRows, templateMeta.question_count);
      if (!parsed.ok) throw new Error(parsed.error);
      setPreviewRows(parsed.rows);
    } catch (previewError) {
      setError(normalizeError(previewError instanceof Error ? previewError.message : null, "No se pudo leer el archivo Excel."));
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleDownloadTemplate() {
    if (!ready) return;

    try {
      setError(null);
      const response = await fetch("/api/superadmin/historical-import/template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hotelId: selectedHotel,
          templateId: selectedTemplate,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(normalizeError(payload?.error, "No se pudo descargar la plantilla."));
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] || "historical_audits_import_template.xlsx";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(normalizeError(downloadError instanceof Error ? downloadError.message : null, "No se pudo descargar la plantilla."));
    }
  }

  async function importNow() {
    try {
      setImporting(true);
      setError(null);
      setResult(null);

      if (!ready) throw new Error("Selecciona hotel y template antes de importar.");
      if (!selectedFile) throw new Error("Selecciona un archivo Excel antes de importar.");

      const formData = new FormData();
      formData.append("hotelId", selectedHotel);
      formData.append("templateId", selectedTemplate);
      formData.append("file", selectedFile);
      const response = await fetch("/api/superadmin/historical-import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | ({ ok: true } & HistoricalImportResult & { error?: string })
        | { ok?: false; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(normalizeError(payload?.error, "No se pudo importar el archivo."));
      }

      setResult(payload);
    } catch (importError) {
      setError(normalizeError(importError instanceof Error ? importError.message : null, "No se pudo importar el archivo."));
    } finally {
      setImporting(false);
    }
  }

  function clearState() {
    setSelectedFile(null);
    setPreviewRows([]);
    setResult(null);
    setError(null);
  }

  if (loading) {
    return <div style={{ color: "#4b5563" }}>Cargando…</div>;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Importar auditorías históricas</div>
          <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
            Sube un archivo .xlsx o .xls con una fila por auditoría y una columna por cada pregunta del template.
          </div>
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Selección</div>
        <select value={selectedHotel} onChange={(event) => void handleHotelChange(event.target.value)} style={inputStyle()}>
          <option value="">Selecciona un hotel</option>
          {hotels.map((hotel) => (
            <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
          ))}
        </select>

        <select value={selectedTemplate} onChange={(event) => void handleTemplateChange(event.target.value)} style={inputStyle()} disabled={!selectedHotel}>
          <option value="">Selecciona un template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>{template.name} · {template.area_name}</option>
          ))}
        </select>
      </div>

      {templateMeta ? (
        <>
          <div style={cardStyle()}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Plantilla</div>
            <div><b>Hotel:</b> {hotels.find((hotel) => hotel.id === selectedHotel)?.name ?? "—"}</div>
            <div><b>Template:</b> {templateMeta.name}</div>
            <div><b>Área:</b> {templateMeta.area_name}</div>
            <div><b>Preguntas activas:</b> {templateMeta.question_count}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void handleDownloadTemplate()} disabled={!ready} style={secondaryButtonStyle(!ready)}>
                Descargar plantilla
              </button>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Formato esperado</div>
            <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Columnas obligatorias: <b>executed_at</b>, <b>auditor_email</b>, <b>team_member_employee_number</b>, <b>notes</b>.
            </div>
            <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Columnas dinámicas: <b>Q__001</b>, <b>Q__002</b>, <b>Q__003</b>, etc.
            </div>
            <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Valores permitidos: <b>PASS</b>, <b>FAIL</b>, <b>NA</b>.
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Carga</div>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={inputStyle()}
              onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void importNow()} disabled={importing || loadingPreview || !selectedFile || !ready} style={primaryButtonStyle(importing || loadingPreview || !selectedFile || !ready)}>
                {importing ? "Importando auditorías..." : "Importar auditorías"}
              </button>
              <button type="button" onClick={clearState} disabled={importing} style={secondaryButtonStyle(importing)}>
                Limpiar
              </button>
            </div>

            {loadingPreview ? <div style={{ color: "#4b5563" }}>Leyendo archivo y preparando vista previa...</div> : null}
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Referencia</div>
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: 10 }}>Código</th>
                    <th style={{ textAlign: "left", padding: 10 }}>Sección</th>
                    <th style={{ textAlign: "left", padding: 10 }}>Pregunta</th>
                  </tr>
                </thead>
                <tbody>
                  {questionReferences.map((question) => (
                    <tr key={question.code} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 10 }}>{question.code}</td>
                      <td style={{ padding: 10 }}>{question.section}</td>
                      <td style={{ padding: 10 }}>{question.question}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {previewRows.length > 0 ? (
        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            Vista previa: {previewSummary.rows} filas detectadas
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Fila</th>
                  <th style={{ textAlign: "left", padding: 10 }}>executed_at</th>
                  <th style={{ textAlign: "left", padding: 10 }}>auditor_email</th>
                  <th style={{ textAlign: "left", padding: 10 }}>employee_number</th>
                  <th style={{ textAlign: "left", padding: 10 }}>notes</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 8).map((row) => (
                  <tr key={row.row_number} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10 }}>{row.row_number}</td>
                    <td style={{ padding: 10 }}>{row.executed_at || "—"}</td>
                    <td style={{ padding: 10 }}>{row.auditor_email || "—"}</td>
                    <td style={{ padding: 10 }}>{row.team_member_employee_number || "—"}</td>
                    <td style={{ padding: 10 }}>{row.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {error ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div> : null}

      {result ? (
        <div style={cardStyle()}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            Resultado: {result.imported_count} importadas, {result.failed_count} fallidas
          </div>
          <div style={{ color: "#4b5563" }}>
            Total de filas procesadas: {result.total_rows}
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Fila</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Estado</th>
                  <th style={{ textAlign: "left", padding: 10 }}>run_id</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {result.row_results.map((row) => (
                  <tr key={`${row.row_number}-${row.run_id ?? row.message}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10 }}>{row.row_number}</td>
                    <td style={{ padding: 10 }}>{row.success ? "Importada" : "Error"}</td>
                    <td style={{ padding: 10 }}>{row.run_id || "—"}</td>
                    <td style={{ padding: 10 }}>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
