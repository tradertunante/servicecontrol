// Shared types and pure utility functions for the template builder

export type TemplateRow = {
  id: string;
  name: string;
  active: boolean | null;
  area_id: string | null;
  hotel_id: string | null;
  created_at: string | null;
  require_room_number: boolean;
  require_audited_employee: boolean;
};

export type CertificationStandardRow = {
  id: string;
  hotel_id: string | null;
  name: string;
  active: boolean;
};

export type AreaRow = {
  id: string;
  name: string;
  type: string | null;
  hotel_id: string | null;
};

export type SectionRow = {
  id: string;
  audit_template_id: string;
  name: string;
  active: boolean | null;
  created_at: string | null;
};

export type RequirementType = "never" | "if_fail" | "always" | "optional";
export type ResponsibleDepartment = string | null;

export type QuestionRow = {
  id: string;
  audit_section_id: string;
  text: string;
  tag: string | null;
  owner_department?: ResponsibleDepartment;
  order: number | null;
  active: boolean;
  comment_requirement: RequirementType;
  photo_requirement: RequirementType;
  signature_requirement: RequirementType;
  created_at: string | null;
};

export type UiRow = {
  questionId: string;
  sectionId: string;
  classification: string;
  tag: string;
  standard: string;
  certificationIds: string[];
  owner_department: ResponsibleDepartment;
  comment_requirement: RequirementType;
  photo_requirement: RequirementType;
  signature_requirement: RequirementType;
  active: boolean;
  order: number;
};

export type ResponsibleDepartmentOption = {
  value: string;
  label: string;
};

// ─── Pure utility functions ───────────────────────────────────────────────────

export function toBool(v: unknown): boolean {
  return v === true;
}

export function safeStr(v: unknown): string {
  return (v ?? "").toString();
}

export function normalizeText(v: string | null | undefined) {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeOrder(n: number | null | undefined, fallback: number) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : fallback;
}

export function toRequirement(v: unknown): RequirementType {
  if (v === "if_fail" || v === "always" || v === "optional") return v;
  return "never";
}

export function toResponsibleDepartment(v: unknown): ResponsibleDepartment {
  if (typeof v !== "string") return null;
  const normalized = v.trim();
  return normalized ? normalized : null;
}

function slugifyResponsibleDepartment(v: string) {
  return normalizeText(v)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getResponsibleDepartmentValue(
  area: Pick<AreaRow, "name" | "type"> | null
): ResponsibleDepartment {
  if (!area) return null;

  const name = normalizeText(area.name);
  const type = normalizeText(area.type);

  if (
    name.includes("housekeeping") ||
    name.includes("ama de llaves") ||
    type === "housekeeping"
  ) {
    return "housekeeping";
  }

  if (
    name.includes("front office") ||
    name.includes("front desk") ||
    name.includes("recepcion") ||
    name.includes("recepción") ||
    type === "front_office" ||
    type === "fo"
  ) {
    return "front_office";
  }

  if (
    name === "it" ||
    name.includes("systems") ||
    name.includes("sistemas") ||
    type === "it" ||
    type === "systems"
  ) {
    return "it";
  }

  if (
    name.includes("mantenimiento") ||
    name.includes("maintenance") ||
    name.includes("engineering") ||
    name.includes("manto") ||
    type === "eng" ||
    type === "engineering"
  ) {
    return "engineering";
  }

  return slugifyResponsibleDepartment(area.name);
}

export function buildResponsibleDepartmentOptions(
  areas: AreaRow[]
): ResponsibleDepartmentOption[] {
  const seen = new Set<string>();
  const options: ResponsibleDepartmentOption[] = [];

  const appendOption = (value: string | null, label: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ value, label });
  };

  appendOption("it", "IT");
  appendOption("engineering", "Mantenimiento");

  for (const area of [...areas].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  )) {
    const value = getResponsibleDepartmentValue(area);
    appendOption(value, area.name);
  }

  return options;
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

export const cardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.75)",
  padding: 18,
};

export const btnBlackStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#000",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  height: 42,
};

export const btnWhiteStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  cursor: "pointer",
  height: 42,
};

export const smallBtnStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
  cursor: "pointer",
  height: 38,
};
