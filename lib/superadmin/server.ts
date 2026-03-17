import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, type RequestAuthContext } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RequirementType = "never" | "if_fail" | "always";

type QuestionOrderRow = {
  id: string;
  audit_section_id: string;
  order: number | null;
  created_at: string | null;
};

const REQUIREMENT_TYPES = new Set<RequirementType>(["never", "if_fail", "always"]);

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

export function jsonOk(extra?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...(extra ?? {}) }, { status });
}

export async function requireSuperadminRoute(request: NextRequest): Promise<RequestAuthContext | null> {
  return authorizeRouteRequest(request, { roles: ["superadmin"] });
}

export function parseRequirementType(value: unknown): RequirementType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim() as RequirementType;
  return REQUIREMENT_TYPES.has(normalized) ? normalized : null;
}

export async function loadGlobalTemplate(templateId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("audit_templates")
    .select("id, scope")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message, status: 500 };
  }

  if (!data?.id) {
    return { ok: false as const, error: "Plantilla no encontrada.", status: 404 };
  }

  if (String(data.scope ?? "") !== "global") {
    return { ok: false as const, error: "La plantilla objetivo no es global.", status: 403 };
  }

  return { ok: true as const, templateId: String(data.id) };
}

export async function loadGlobalPack(packId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("global_audit_packs")
    .select("id")
    .eq("id", packId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message, status: 500 };
  }

  if (!data?.id) {
    return { ok: false as const, error: "Pack no encontrado.", status: 404 };
  }

  return { ok: true as const, packId: String(data.id) };
}

function safeTime(iso: string | null) {
  return iso ? new Date(iso).getTime() : 0;
}

export async function normalizeTemplateQuestionOrder(templateId: string) {
  const admin = supabaseAdmin();
  const { data: sections, error: sectionsError } = await admin
    .from("audit_sections")
    .select("id")
    .eq("audit_template_id", templateId);

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const sectionIds = (sections ?? []).map((row) => String(row.id ?? "")).filter(Boolean);
  if (sectionIds.length === 0) {
    return { updated: 0 };
  }

  const { data: questions, error: questionsError } = await admin
    .from("audit_questions")
    .select("id, audit_section_id, order, created_at")
    .in("audit_section_id", sectionIds)
    .order("audit_section_id", { ascending: true })
    .order("order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  const rows = (questions ?? []) as QuestionOrderRow[];
  if (rows.length === 0) {
    return { updated: 0 };
  }

  const bySection: Record<string, QuestionOrderRow[]> = {};
  for (const row of rows) {
    if (!bySection[row.audit_section_id]) {
      bySection[row.audit_section_id] = [];
    }
    bySection[row.audit_section_id].push(row);
  }

  const updates: Array<{ id: string; order: number }> = [];

  for (const sectionId of Object.keys(bySection)) {
    const list = bySection[sectionId];
    list.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;

      const at = safeTime(a.created_at);
      const bt = safeTime(b.created_at);
      if (at !== bt) return at - bt;

      return a.id.localeCompare(b.id);
    });

    let position = 1;
    for (const row of list) {
      if (row.order !== position) {
        updates.push({ id: row.id, order: position });
      }
      position += 1;
    }
  }

  if (updates.length === 0) {
    return { updated: 0 };
  }

  const { error: updateError } = await admin
    .from("audit_questions")
    .upsert(updates, { onConflict: "id" });

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { updated: updates.length };
}
