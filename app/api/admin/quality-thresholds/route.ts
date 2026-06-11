import { NextRequest, NextResponse } from "next/server";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULTS = {
  success_score_min: 90,
  warning_score_min: 75,
  success_fail_rate_max: 5,
  warning_fail_rate_max: 15,
};

async function getScope(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["admin", "superadmin", "general_manager"],
  });
  if (!caller) return { ok: false as const, error: "No autorizado.", status: 401 };

  const hotelResult = await resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) return { ok: false as const, error: hotelResult.error, status: 403 };

  return { ok: true as const, hotelId: hotelResult.hotelId };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await getScope(request);
    if (!scope.ok) return jsonError(scope.error, scope.status);

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("hotel_quality_thresholds")
      .select("success_score_min, warning_score_min, success_fail_rate_max, warning_fail_rate_max")
      .eq("hotel_id", scope.hotelId)
      .maybeSingle();

    if (error) return jsonDbError(error, "No se pudieron cargar los umbrales.");

    return NextResponse.json({ ok: true, thresholds: data ?? DEFAULTS });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await getScope(request);
    if (!scope.ok) return jsonError(scope.error, scope.status);

    const body = await request.json().catch(() => null);

    const fields = ["success_score_min", "warning_score_min", "success_fail_rate_max", "warning_fail_rate_max"] as const;
    for (const f of fields) {
      const v = body?.[f];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) {
        return jsonError(`Campo inválido: ${f}. Debe ser un número entre 0 y 100.`, 400);
      }
    }

    if (body.warning_score_min > body.success_score_min) {
      return jsonError("La puntuación mínima de Atención no puede ser mayor que la de Óptimo.", 400);
    }
    if (body.success_fail_rate_max > body.warning_fail_rate_max) {
      return jsonError("La tasa máxima de fallos de Óptimo no puede ser mayor que la de Atención.", 400);
    }

    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("hotel_quality_thresholds")
      .upsert(
        {
          hotel_id: scope.hotelId,
          success_score_min: body.success_score_min,
          warning_score_min: body.warning_score_min,
          success_fail_rate_max: body.success_fail_rate_max,
          warning_fail_rate_max: body.warning_fail_rate_max,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "hotel_id" }
      );

    if (error) return jsonDbError(error, "No se pudieron guardar los umbrales.");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}