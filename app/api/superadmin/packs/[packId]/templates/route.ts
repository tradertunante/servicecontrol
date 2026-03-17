import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  jsonError,
  jsonOk,
  loadGlobalPack,
  loadGlobalTemplate,
  requireSuperadminRoute,
} from "@/lib/superadmin/server";

async function getNextPackPosition(packId: string) {
  const { data, error } = await supabaseAdmin()
    .from("global_audit_pack_templates")
    .select("position")
    .eq("pack_id", packId)
    .order("position", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const lastPosition = Number(data?.[0]?.position ?? 0);
  return lastPosition + 10;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  const caller = await requireSuperadminRoute(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const packId = String(params.packId ?? "").trim();
  if (!packId) return jsonError("packId es obligatorio.");

  const pack = await loadGlobalPack(packId);
  if (!pack.ok) return jsonError(pack.error, pack.status);

  const body = await request.json().catch(() => null);
  const templateId = String(body?.template_id ?? "").trim();
  const templateName = String(body?.template_name ?? "").trim();

  let effectiveTemplateId = templateId;
  const admin = supabaseAdmin();

  if (templateName) {
    const { data, error } = await admin
      .from("audit_templates")
      .insert({
        name: templateName,
        scope: "global",
        active: true,
        area_id: null,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return jsonError(error?.message ?? "No se pudo crear la plantilla global.", 500);
    }

    effectiveTemplateId = String(data.id);
  } else {
    if (!effectiveTemplateId) {
      return jsonError("template_id o template_name es obligatorio.");
    }

    const template = await loadGlobalTemplate(effectiveTemplateId);
    if (!template.ok) return jsonError(template.error, template.status);
    effectiveTemplateId = template.templateId;
  }

  const { data: existingLink, error: existingLinkError } = await admin
    .from("global_audit_pack_templates")
    .select("pack_id")
    .eq("pack_id", pack.packId)
    .eq("audit_template_id", effectiveTemplateId)
    .maybeSingle();

  if (existingLinkError) return jsonError(existingLinkError.message, 500);
  if (existingLink?.pack_id) return jsonError("La plantilla ya esta asociada a este pack.", 409);

  let position: number;
  try {
    position = await getNextPackPosition(pack.packId);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo calcular la posicion.", 500);
  }

  const { error: insertLinkError } = await admin
    .from("global_audit_pack_templates")
    .insert({
      pack_id: pack.packId,
      audit_template_id: effectiveTemplateId,
      position,
    });

  if (insertLinkError) return jsonError(insertLinkError.message, 500);

  return jsonOk({
    pack_id: pack.packId,
    template_id: effectiveTemplateId,
    created_template: Boolean(templateName),
    updated_by: caller.profile.id,
  });
}
