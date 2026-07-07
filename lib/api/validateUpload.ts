import { NextResponse } from "next/server";

import { jsonError } from "./response";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Magic bytes de los contenedores de hoja de cálculo aceptados:
// - .xlsx (OOXML) es un ZIP → cabecera "PK\x03\x04"
// - .xls (BIFF/OLE2) → cabecera "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"
// Validar el contenido —no solo la extensión del nombre— evita que un fichero
// arbitrario (p. ej. un payload que dispare el ReDoS del parser) se procese
// solo por llamarse .xlsx.
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

export type SpreadsheetUploadResult =
  | { ok: true; arrayBuffer: ArrayBuffer; bytes: Uint8Array }
  | { ok: false; response: NextResponse };

/**
 * Valida un fichero subido como hoja de cálculo antes de parsearlo:
 * tamaño máximo, extensión permitida y magic bytes reales del contenido.
 * Devuelve el ArrayBuffer ya leído para evitar leerlo dos veces.
 */
export async function validateSpreadsheetUpload(
  file: unknown,
  options?: { maxBytes?: number },
): Promise<SpreadsheetUploadResult> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!(file instanceof File)) {
    return { ok: false, response: jsonError("Debes adjuntar un archivo Excel.", 400) };
  }

  if (file.size === 0) {
    return { ok: false, response: jsonError("El archivo está vacío.", 400) };
  }

  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, response: jsonError(`El archivo no puede superar ${mb} MB.`, 400) };
  }

  const fileName = String(file.name ?? "").toLowerCase();
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return { ok: false, response: jsonError("El archivo debe ser .xlsx o .xls.", 400) };
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const isXlsx = startsWith(bytes, ZIP_SIGNATURE);
  const isXls = startsWith(bytes, OLE2_SIGNATURE);
  if (!isXlsx && !isXls) {
    return {
      ok: false,
      response: jsonError("El contenido del archivo no es un Excel válido (.xlsx o .xls).", 400),
    };
  }

  return { ok: true, arrayBuffer, bytes };
}
