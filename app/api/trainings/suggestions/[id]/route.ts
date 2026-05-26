import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getTrainingsCaller,
  enforceTrainingAreaScope,
} from "@/lib/trainings/server";
import { jsonError, jsonDbError } from "@/lib/api/response";

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/trainings/suggestions/[id]
 * Body: { action: 'approve' | 'reject' | 'realize' }
 *
 * approve — only manager (or admin/gm) with access to the area.
 *   Creates a training_topic from the AI content and notifies quality members.
 * reject — same permissions as approve.
 * realize — only after approval; marks the topic as done.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: suggestionId } = await params;

    const callerResult = await getTrainingsCaller(request, [
      "admin",
      "quality",
      "manager",
      "general_manager",
    ]);
    if (!callerResult.ok) return jsonError(callerResult.error, callerResult.status);

    const { profile, hotelId } = callerResult.caller;

    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "").trim();

    if (!["approve", "reject", "realize"].includes(action)) {
      return jsonError("action debe ser 'approve', 'reject' o 'realize'.");
    }

    const admin = supabaseAdmin();

    // Load suggestion
    const { data: suggestion, error: loadError } = await admin
      .from("ai_training_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .eq("hotel_id", hotelId)
      .maybeSingle();

    if (loadError) return jsonDbError(loadError);
    if (!suggestion) return jsonError("Sugerencia no encontrada.", 404);

    // Area scope check (manager can only touch their areas)
    const scopeCheck = await enforceTrainingAreaScope(profile, hotelId, String(suggestion.area_id));
    if (!scopeCheck.ok) return jsonError(scopeCheck.error, scopeCheck.status);

    const now = new Date().toISOString();

    if (action === "approve") {
      if (suggestion.review_status !== "pending") {
        return jsonError("Solo se pueden aprobar sugerencias en estado 'pending'.", 409);
      }

      const content = suggestion.ai_content as {
        objective?: string;
        procedure?: string[];
      };
      const title = String(suggestion.question_text).slice(0, 200);
      const description = content?.objective ?? null;
      const qrToken = crypto.randomUUID().replace(/-/g, "");

      // Create training topic
      const { data: topic, error: topicError } = await admin
        .from("training_topics")
        .insert({
          hotel_id: hotelId,
          area_id: suggestion.area_id,
          title,
          description,
          qr_token: qrToken,
          created_by: profile.id,
        })
        .select("id, title")
        .single();

      if (topicError || !topic) return jsonDbError(topicError, "No se pudo crear el tema de formación.");

      // Update suggestion
      const { error: updateError } = await admin
        .from("ai_training_suggestions")
        .update({
          review_status: "approved",
          reviewed_by: profile.id,
          reviewed_at: now,
          approved_at: now,
          topic_id: topic.id,
        })
        .eq("id", suggestionId);

      if (updateError) return jsonDbError(updateError);

      // Notify quality members about the new training topic
      const { data: qualityProfiles } = await admin
        .from("profiles")
        .select("id")
        .eq("hotel_id", hotelId)
        .in("role", ["quality", "admin", "general_manager"]);

      const areaId = String(suggestion.area_id ?? "");
      const { data: area } = await admin.from("areas").select("name").eq("id", areaId).maybeSingle();
      const areaName = area?.name ?? "un área";

      for (const qp of qualityProfiles ?? []) {
        if (!qp.id) continue;
        await admin.rpc("notify_user", {
          p_hotel_id: hotelId,
          p_user_id: qp.id,
          p_type: "training_suggestion_approved",
          p_title: "Nueva formación aprobada por manager",
          p_body: `Se ha aprobado una formación para ${areaName}: "${topic.title}"`,
          p_link: `/trainings`,
        });
      }

      return jsonNoStore({ ok: true, topic_id: topic.id });
    }

    if (action === "reject") {
      if (suggestion.review_status !== "pending") {
        return jsonError("Solo se pueden rechazar sugerencias en estado 'pending'.", 409);
      }

      const { error: updateError } = await admin
        .from("ai_training_suggestions")
        .update({
          review_status: "rejected",
          reviewed_by: profile.id,
          reviewed_at: now,
        })
        .eq("id", suggestionId);

      if (updateError) return jsonDbError(updateError);
      return jsonNoStore({ ok: true });
    }

    if (action === "realize") {
      if (suggestion.review_status !== "approved") {
        return jsonError("Solo se pueden marcar como realizadas las sugerencias aprobadas.", 409);
      }

      const { error: updateError } = await admin
        .from("ai_training_suggestions")
        .update({
          review_status: "realized",
          realized_at: now,
        })
        .eq("id", suggestionId);

      if (updateError) return jsonDbError(updateError);
      return jsonNoStore({ ok: true });
    }

    return jsonError("Acción no reconocida.", 400);
  } catch (error) {
    return jsonDbError(
      error instanceof Error ? { message: error.message } : null,
      "Error inesperado."
    );
  }
}