import { NextRequest, NextResponse } from "next/server";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

const VALID_FIELDS = new Set(["comment_requirement", "photo_requirement", "signature_requirement"]);
const VALID_VALUES = new Set(["never", "if_fail", "optional", "always"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
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

  const { data: sections, error: sErr } = await admin
    .from("audit_sections")
    .select("id")
    .eq("audit_template_id", templateId);

  if (sErr) return jsonDbError(sErr);

  const sectionIds = (sections ?? []).map((s) => String(s.id));
  if (sectionIds.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { data: updated, error: uErr } = await admin
    .from("audit_questions")
    .update({ [field]: value })
    .in("audit_section_id", sectionIds)
    .select("id");

  if (uErr) return jsonDbError(uErr);

  return NextResponse.json({ ok: true, updated: (updated ?? []).length });
}