import { jsonError } from "./response";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a value is a valid UUID v4 format.
 * Returns the trimmed UUID string if valid, or a NextResponse error if invalid.
 */
export function parseUUID(
  raw: unknown,
  label = "id",
): string | ReturnType<typeof jsonError> {
  const value = String(raw ?? "").trim();
  if (!value) return jsonError(`${label} es obligatorio.`);
  if (!UUID_RE.test(value)) return jsonError(`${label} no es un UUID válido.`);
  return value;
}

/**
 * Type guard: returns true if parseUUID returned an error response.
 */
export function isErrorResponse(
  result: string | Response,
): result is Response {
  return typeof result !== "string";
}
