import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTrainingsCaller, getTrainingsVisibleAreaIds } from "@/lib/trainings/server";
import { jsonError, jsonDbError } from "@/lib/api/response";

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const callerResult = await getTrainingsCaller(request, [
      "admin",
      "quality",
      "manager",
      "general_manager",
    ]);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const { profile, hotelId } = callerResult.caller;

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status"); // 'pending' | 'approved' | 'realized' | 'rejected' | null = all

    const allowedAreaIds = await getTrainingsVisibleAreaIds(profile, hotelId);
    if (allowedAreaIds.length === 0) {
      return jsonNoStore({ ok: true, suggestions: [] });
    }

    const admin = supabaseAdmin();
    let query = admin
      .from("ai_training_suggestions")
      .select(
        "id, hotel_id, area_id, question_id, question_text, trigger_ratio, trigger_count, trigger_period_days, ai_content, review_status, reviewed_at, approved_at, realized_at, topic_id, created_at"
      )
      .eq("hotel_id", hotelId)
      .in("area_id", allowedAreaIds)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("review_status", statusFilter);
    }

    const { data: suggestions, error } = await query;
    if (error) return jsonDbError(error);

    // Enrich with area names
    const areaIds = Array.from(new Set((suggestions ?? []).map((s) => s.area_id)));
    const { data: areas, error: areasError } = areaIds.length
      ? await admin.from("areas").select("id, name").in("id", areaIds)
      : { data: [], error: null };
    if (areasError) return jsonDbError(areasError);

    const areaNameById = new Map((areas ?? []).map((a) => [String(a.id), String(a.name)]));

    return jsonNoStore({
      ok: true,
      suggestions: (suggestions ?? []).map((s) => ({
        ...s,
        area_name: areaNameById.get(String(s.area_id)) ?? null,
      })),
    });
  } catch (error) {
    return jsonDbError(
      error instanceof Error ? { message: error.message } : null,
      "Error inesperado."
    );
  }
}