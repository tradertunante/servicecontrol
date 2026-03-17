export const MEMBER_IMPORT_TEMPLATE_FILE_NAME = "members_import_template.xlsx";

export const MEMBER_IMPORT_REQUIRED_HEADERS = ["full_name", "employee_number"] as const;
export const MEMBER_IMPORT_OPTIONAL_HEADERS = ["active", "areas"] as const;
export const MEMBER_IMPORT_HEADERS = [
  ...MEMBER_IMPORT_REQUIRED_HEADERS,
  ...MEMBER_IMPORT_OPTIONAL_HEADERS,
] as const;

export type MemberImportHeader = (typeof MEMBER_IMPORT_HEADERS)[number];

export type ParsedMemberImportRow = {
  row_number: number;
  full_name: string;
  employee_number: string;
  active: string;
  areas: string;
};

const HEADER_ALIASES: Record<string, MemberImportHeader> = {
  full_name: "full_name",
  fullname: "full_name",
  full_name_field: "full_name",
  full_name_column: "full_name",
  full_name_header: "full_name",
  full_name_label: "full_name",
  full_name_name: "full_name",
  full_name_complete: "full_name",
  name: "full_name",
  nombre: "full_name",
  nombre_completo: "full_name",
  employee_number: "employee_number",
  employeenumber: "employee_number",
  employee_no: "employee_number",
  employee_num: "employee_number",
  employee: "employee_number",
  numero_de_colaborador: "employee_number",
  numero_colaborador: "employee_number",
  no_colaborador: "employee_number",
  no_de_colaborador: "employee_number",
  numero_empleado: "employee_number",
  active: "active",
  activo: "active",
  is_active: "active",
  areas: "areas",
  area: "areas",
  area_names: "areas",
  assigned_areas: "areas",
  areas_asignadas: "areas",
};

export const MEMBER_IMPORT_TEMPLATE_ROW: ParsedMemberImportRow = {
  row_number: 2,
  full_name: "Maria Jose Manon",
  employee_number: "001",
  active: "true",
  areas: "PLC - Front, THR - Front",
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeImportHeader(value: unknown) {
  const base = stripDiacritics(normalizeText(value).toLowerCase())
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return HEADER_ALIASES[base] ?? null;
}

export function normalizeAreaLabel(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBooleanLike(value: string) {
  const normalized = stripDiacritics(value).toLowerCase().trim();

  if (!normalized) return { ok: true as const, value: true };
  if (["true", "yes", "si", "1"].includes(normalized)) return { ok: true as const, value: true };
  if (["false", "no", "0"].includes(normalized)) return { ok: true as const, value: false };

  return {
    ok: false as const,
    error: "La columna active solo acepta true/false, yes/no, si/no o 1/0.",
  };
}

export function splitAreas(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseMemberImportRows(sheetRows: unknown[][]) {
  const [headerRow, ...dataRows] = sheetRows;

  if (!headerRow || !headerRow.length) {
    return { ok: false as const, error: "El archivo no contiene encabezados." };
  }

  const headerMap = new Map<MemberImportHeader, number>();

  headerRow.forEach((headerValue, index) => {
    const normalized = normalizeImportHeader(headerValue);
    if (normalized && !headerMap.has(normalized)) {
      headerMap.set(normalized, index);
    }
  });

  const missingHeaders = MEMBER_IMPORT_REQUIRED_HEADERS.filter((header) => !headerMap.has(header));
  if (missingHeaders.length > 0) {
    return {
      ok: false as const,
      error: `Faltan columnas obligatorias: ${missingHeaders.join(", ")}.`,
    };
  }

  const parsedRows = dataRows
    .map((row, index) => {
      const rowValues = Array.isArray(row) ? row : [];
      const getValue = (header: MemberImportHeader) => {
        const headerIndex = headerMap.get(header);
        return headerIndex == null ? "" : normalizeText(rowValues[headerIndex]);
      };

      return {
        row_number: index + 2,
        full_name: getValue("full_name"),
        employee_number: getValue("employee_number"),
        active: getValue("active"),
        areas: getValue("areas"),
      } satisfies ParsedMemberImportRow;
    })
    .filter((row) => Object.values(row).some((value) => String(value).trim() !== ""));

  return {
    ok: true as const,
    rows: parsedRows,
  };
}
