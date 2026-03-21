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
    <div className="border border-[#e5e7eb] bg-white p-4 rounded-xl grid gap-3">
      <div className="flex justify-between gap-3 flex-wrap items-start">
        <div className="grid gap-1.5">
          <div className="text-lg font-extrabold">Importar Excel</div>
          <div className="text-[#4b5563] leading-[1.5]">
            Sube un archivo <b>.xlsx</b> o <b>.xls</b> con columnas <b>full_name</b>, <b>employee_number</b>, <b>active</b> y <b>areas</b>.
            Las areas deben coincidir por nombre visible del hotel actual y pueden venir separadas por comas.
          </div>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="border border-[#d1d5db] bg-white text-[#111827] px-3 py-2.5 rounded-[10px] font-bold cursor-pointer"
        >
          Descargar plantilla
        </button>
      </div>

      <div className="grid gap-2">
        <div className="font-bold">Formato esperado</div>
        <div className="text-[#4b5563] leading-[1.5]">
          `full_name` y `employee_number` son obligatorios. `active` acepta `true/false`, `yes/no`, `si/no`, `1/0`. Si viene vacio, se toma como activo. `areas` es opcional.
        </div>
        <div className="text-[#4b5563] leading-[1.5]">
          Areas disponibles en tu alcance actual: {areaOptions.length ? areaOptions.map((area) => area.name).join(", ") : "Sin areas disponibles"}
        </div>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="border border-[#d1d5db] rounded-[10px] px-3 py-2.5 w-full bg-white"
        onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
      />

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => void importNow()}
          disabled={importing || loadingPreview || !selectedFile}
          className={`border border-[#d1d5db] px-3 py-2.5 rounded-[10px] font-bold ${importing || loadingPreview || !selectedFile ? "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed" : "bg-[#111827] text-white cursor-pointer"}`}
        >
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
          className={`border border-[#d1d5db] bg-white px-3 py-2.5 rounded-[10px] font-bold ${importing ? "text-[#9ca3af] cursor-not-allowed" : "text-[#111827] cursor-pointer"}`}
        >
          Limpiar
        </button>
      </div>

      {loadingPreview ? <div className="text-[#4b5563]">Leyendo archivo y preparando vista previa...</div> : null}
      {error ? <div className="text-[#b91c1c] font-semibold">{error}</div> : null}

      {previewRows.length > 0 ? (
        <div className="grid gap-2">
          <div className="text-base font-extrabold">
            Vista previa: {previewSummary.rows} filas detectadas
          </div>
          <div className="overflow-x-auto border border-[#e5e7eb] rounded-[10px]">
            <table className="w-full border-collapse">
              <thead className="bg-[#f9fafb]">
                <tr>
                  <th className="text-left p-2.5">Fila</th>
                  <th className="text-left p-2.5">Nombre</th>
                  <th className="text-left p-2.5">No. colaborador</th>
                  <th className="text-left p-2.5">Activo</th>
                  <th className="text-left p-2.5">Areas</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 8).map((row) => (
                  <tr key={row.row_number} className="border-t border-[#e5e7eb]">
                    <td className="p-2.5">{row.row_number}</td>
                    <td className="p-2.5">{row.full_name || "—"}</td>
                    <td className="p-2.5">{row.employee_number || "—"}</td>
                    <td className="p-2.5">{row.active || "true"}</td>
                    <td className="p-2.5">{row.areas || "—"}</td>
                  </tr>
                ))}
                {previewRows.length > 8 ? (
                  <tr className="border-t border-[#e5e7eb]">
                    <td colSpan={5} className="p-2.5 text-[#4b5563]">
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
        <div className="grid gap-2.5">
          <div className="text-base font-extrabold">
            Resultado: {result.created_count} creados, {result.skipped_count} omitidos, {result.error_count} con error
          </div>
          <div className="text-[#4b5563]">
            Total procesado: {result.total_rows}. La importacion es parcial: las filas validas se crean aunque otras fallen.
          </div>
          <div className="overflow-x-auto border border-[#e5e7eb] rounded-[10px]">
            <table className="w-full border-collapse">
              <thead className="bg-[#f9fafb]">
                <tr>
                  <th className="text-left p-2.5">Fila</th>
                  <th className="text-left p-2.5">Estado</th>
                  <th className="text-left p-2.5">Nombre</th>
                  <th className="text-left p-2.5">No. colaborador</th>
                  <th className="text-left p-2.5">Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {result.row_results.map((row) => (
                  <tr key={`${row.row_number}-${row.employee_number}-${row.status}`} className="border-t border-[#e5e7eb]">
                    <td className="p-2.5">{row.row_number}</td>
                    <td className="p-2.5 font-bold">
                      {row.status === "created" ? "Creado" : row.status === "skipped" ? "Omitido" : "Error"}
                    </td>
                    <td className="p-2.5">{row.full_name || "—"}</td>
                    <td className="p-2.5">{row.employee_number || "—"}</td>
                    <td className="p-2.5">{row.message}</td>
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
