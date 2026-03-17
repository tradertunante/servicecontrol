"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { supabase } from "@/lib/supabaseClient";
import {
  MEMBER_IMPORT_HEADERS,
  MEMBER_IMPORT_TEMPLATE_FILE_NAME,
  MEMBER_IMPORT_TEMPLATE_ROW,
  parseMemberImportRows,
} from "@/lib/members/import";
import type { MemberAreaOption, MemberImportPreviewRow, MemberImportResponse } from "../_lib/memberTypes";

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
  const safeMessage = String(message ?? "").trim();
  return safeMessage || fallback;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function MembersImportPanel({
  hotelId,
  role,
  areaOptions,
  onImported,
}: {
  hotelId: string | null;
  role: string;
  areaOptions: MemberAreaOption[];
  onImported: (createdCount: number) => Promise<void> | void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<MemberImportPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MemberImportResponse | null>(null);

  const previewSummary = useMemo(
    () => ({
      rows: previewRows.length,
      shown: Math.min(previewRows.length, 8),
    }),
    [previewRows]
  );

  async function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setPreviewRows([]);
    setResult(null);
    setError(null);

    if (!file) {
      return;
    }

    try {
      setLoadingPreview(true);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("El archivo no contiene hojas.");
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
        raw: false,
      });

      const parsed = parseMemberImportRows(rawRows);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      setPreviewRows(parsed.rows);
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : null, "No se pudo leer el archivo Excel."));
    } finally {
      setLoadingPreview(false);
    }
  }

  function downloadTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        full_name: MEMBER_IMPORT_TEMPLATE_ROW.full_name,
        employee_number: MEMBER_IMPORT_TEMPLATE_ROW.employee_number,
        active: MEMBER_IMPORT_TEMPLATE_ROW.active,
        areas: MEMBER_IMPORT_TEMPLATE_ROW.areas,
      },
    ], {
      header: [...MEMBER_IMPORT_HEADERS],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "members");
    XLSX.writeFile(workbook, MEMBER_IMPORT_TEMPLATE_FILE_NAME);
  }

  async function importNow() {
    try {
      setImporting(true);
      setError(null);
      setResult(null);

      if (!selectedFile) {
        throw new Error("Selecciona un archivo Excel antes de importar.");
      }

      const token = await getAccessToken();
      if (!token) {
        throw new Error("Sesion invalida.");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/members/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = (await res.json().catch(() => null)) as (MemberImportResponse & { error?: string }) | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(normalizeError(payload?.error, "No se pudo importar el archivo."));
      }

      setResult(payload);
      if (payload.created_count > 0) {
        await onImported(payload.created_count);
      }
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : null, "No se pudo importar el archivo."));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Importar Excel</div>
          <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
            Sube un archivo <b>.xlsx</b> o <b>.xls</b> con columnas <b>full_name</b>, <b>employee_number</b>, <b>active</b> y <b>areas</b>.
            Las areas deben coincidir por nombre visible del hotel actual y pueden venir separadas por comas.
          </div>
        </div>
        <button type="button" onClick={downloadTemplate} style={secondaryButtonStyle(false)}>
          Descargar plantilla
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Formato esperado</div>
        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
          `full_name` y `employee_number` son obligatorios. `active` acepta `true/false`, `yes/no`, `si/no`, `1/0`. Si viene vacio, se toma como activo. `areas` es opcional.
        </div>
        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
          Areas disponibles en tu alcance actual: {areaOptions.length ? areaOptions.map((area) => area.name).join(", ") : "Sin areas disponibles"}
        </div>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={inputStyle()}
        onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void importNow()} disabled={importing || loadingPreview || !selectedFile} style={primaryButtonStyle(importing || loadingPreview || !selectedFile)}>
          {importing ? "Procesando importacion..." : "Importar Excel"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedFile(null);
            setPreviewRows([]);
            setResult(null);
            setError(null);
          }}
          disabled={importing}
          style={secondaryButtonStyle(importing)}
        >
          Limpiar
        </button>
      </div>

      {loadingPreview ? <div style={{ color: "#4b5563" }}>Leyendo archivo y preparando vista previa...</div> : null}
      {error ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div> : null}

      {previewRows.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            Vista previa: {previewSummary.rows} filas detectadas
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Fila</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Nombre</th>
                  <th style={{ textAlign: "left", padding: 10 }}>No. colaborador</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Activo</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Areas</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 8).map((row) => (
                  <tr key={row.row_number} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10 }}>{row.row_number}</td>
                    <td style={{ padding: 10 }}>{row.full_name || "—"}</td>
                    <td style={{ padding: 10 }}>{row.employee_number || "—"}</td>
                    <td style={{ padding: 10 }}>{row.active || "true"}</td>
                    <td style={{ padding: 10 }}>{row.areas || "—"}</td>
                  </tr>
                ))}
                {previewRows.length > 8 ? (
                  <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td colSpan={5} style={{ padding: 10, color: "#4b5563" }}>
                      ... y {previewRows.length - 8} filas mas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            Resultado: {result.created_count} creados, {result.skipped_count} omitidos, {result.error_count} con error
          </div>
          <div style={{ color: "#4b5563" }}>
            Total procesado: {result.total_rows}. La importacion es parcial: las filas validas se crean aunque otras fallen.
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Fila</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Estado</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Nombre</th>
                  <th style={{ textAlign: "left", padding: 10 }}>No. colaborador</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {result.row_results.map((row) => (
                  <tr key={`${row.row_number}-${row.employee_number}-${row.status}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10 }}>{row.row_number}</td>
                    <td style={{ padding: 10, fontWeight: 700 }}>
                      {row.status === "created" ? "Creado" : row.status === "skipped" ? "Omitido" : "Error"}
                    </td>
                    <td style={{ padding: 10 }}>{row.full_name || "—"}</td>
                    <td style={{ padding: 10 }}>{row.employee_number || "—"}</td>
                    <td style={{ padding: 10 }}>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
