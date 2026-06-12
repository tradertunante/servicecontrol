import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";

// Los nombres de archivo son `${runId}_${questionId}_${timestamp}.ext`; el prefijo
// runId permite autorizar por hotel sin tabla auxiliar.
const FILE_NAME_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[\w.-]+\.(jpe?g|png|webp|heic)$/i;

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * GET /api/photos/[fileName]
 *
 * El bucket audit-photos es privado: la app guarda `/api/photos/<file>` en
 * photo_paths y este endpoint valida sesión + hotel del run y redirige a una
 * signed URL de corta duración. Así la evidencia fotográfica deja de ser
 * accesible por URL filtrada y es revocable desactivando al usuario.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileName: string }> }
) {
  const { fileName } = await context.params;
  if (!FILE_NAME_REGEX.test(fileName)) return jsonError("Archivo no encontrado.", 404);

  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const runId = fileName.slice(0, 36);
  const admin = supabaseAdmin();

  if (caller.profile.role !== "superadmin") {
    const hotelResult = await resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    const { data: run } = await admin
      .from("audit_runs")
      .select("id, hotel_id")
      .eq("id", runId)
      .maybeSingle();

    if (!run?.id || String(run.hotel_id ?? "") !== hotelResult.hotelId) {
      return jsonError("Archivo no encontrado.", 404);
    }
  }

  const { data, error } = await admin.storage
    .from("audit-photos")
    .createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return jsonError("No se pudo generar el acceso a la foto.", 500);
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${SIGNED_URL_TTL_SECONDS - 60}` },
  });
}