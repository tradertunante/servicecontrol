import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError } from "@/lib/api/response";

/**
 * GET /api/reports/narratives/latest?hotel_id=...&period_type=weekly|monthly
 * Returns the most recent AI narrative for a hotel and period type.
 */
export async function GET(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const { searchParams } = new URL(request.url);
  const hotelId = searchParams.get("hotel_id")?.trim();
  const periodType = searchParams.get("period_type") ?? "weekly";

  if (!hotelId) return jsonError("hotel_id es obligatorio.", 400);

  const hotelResult = await resolveRouteHotelScope(caller.profile, hotelId);
  if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("report_narratives")
    .select("id,period_label,period_type,narrative_hotel,overall_score,prev_overall_score,total_audits,created_at")
    .eq("hotel_id", hotelResult.hotelId)
    .eq("period_type", periodType)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ narrative: null });

  return NextResponse.json({ narrative: data });
}