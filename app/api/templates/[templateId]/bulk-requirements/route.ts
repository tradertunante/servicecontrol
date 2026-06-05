import { NextRequest, NextResponse } from "next/server";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";
import { logger } from "@/lib/logger";

const VALID_FIELDS = new Set(["comment_requirement", "photo_requirement", "signature_requirement"]);
const VALID_VALUES = new Set(["never", "if_fail", "optional", "always"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const caller = await authorizeRouteRequest(request, { roles: ["admin", "superadmin"] });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const templateId = parseUUID(params.templateId, "templateId");
    if (isErrorResponse(templateId)) return templateId;

    const body = await request.json().catch(() => null);
    const field = String(body?.field ?? "").trim();
    const value = String(body?.value ?? "").trim();

    if (!VALID_FIELDS.has(field)) return jsonError("field debe ser comment_requirement, photo_requirement o signature_requirement.");
    if (!VALID_VALUES.has(value)) return jsonError("value debe ser never, if_fail, optional o always.");

    const admin = supabaseAdmin();

    const { data: template, error: tErr } = await admin
      .from("audit_templates")
      .select("id, hotel_id")
      .eq("id", templateId)
      .single();

    if (tErr || !template) return jsonError("Plantilla no encontrada.", 404);
    if (template.hotel_id !== hotelResult.hotelId) return jsonError("La plantilla no pertenece al hotel activo.", 403);

    // 1. Fetch section IDs for this template
    const { data: sections, error: sErr } = await admin
      .from("audit_sections")
      .select("id")
      .eq("audit_template_id", templateId);

    if (sErr) {
      logger.error("bulk_requirements_error", { step: "fetch_sections", templateId, code: sErr.code, message: sErr.message });
      return NextResponse.json({ ok: false, error: `[paso 1/fetch_sections] ${sErr.code ?? ""}: ${sErr.message}` }, { status: 500 });
    }

    const sectionIds = (sections ?? []).map((s) => String(s.id));
    if (sectionIds.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    // 2. Fetch question IDs for those sections
    const { data: questions, error: qErr } = await admin
      .from("audit_questions")
      .select("id")
      .in("audit_section_id", sectionIds);

    if (qErr) {
      logger.error("bulk_requirements_error", { step: "fetch_questions", templateId, code: qErr.code, message: qErr.message });
      return NextResponse.json({ ok: false, error: `[paso 2/fetch_questions] ${qErr.code ?? ""}: ${qErr.message}` }, { status: 500 });
    }

    const questionIds = (questions ?? []).map((q) => String(q.id));
    if (questionIds.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    // 3. Update questions by ID (most reliable pattern, bypasses any RLS on section join)
    const { error: uErr } = await admin
      .from("audit_questions")
      .update({ [field]: value })
      .in("id", questionIds);

    if (uErr) {
      logger.error("bulk_requirements_error", {
        step: "update_questions",
        templateId,
        field,
        value,
        questionCount: questionIds.length,
        code: uErr.code,
        message: uErr.message,
        hint: uErr.hint,
      });
      return NextResponse.json({ ok: false, error: `[paso 3/update_questions] ${uErr.code ?? ""}: ${uErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: questionIds.length });
  } catch (err: unknown) {
    logger.error("bulk_requirements_unexpected_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "Error interno del servidor." }, { status: 500 });
  }
}