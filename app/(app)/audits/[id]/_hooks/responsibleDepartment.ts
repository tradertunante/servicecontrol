export type ResponsibleDepartment = "engineering" | "systems" | null;

export function toResponsibleDepartment(value: unknown): ResponsibleDepartment {
  if (value === "engineering" || value === "systems") return value;
  return null;
}
