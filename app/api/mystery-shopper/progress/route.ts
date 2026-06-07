import { NextRequest, NextResponse } from "next/server";

import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    // Both mystery_shopper (own progress) and admin/superadmin (any shopper) can call this
    const caller = await authorizeRouteRequest(request, {
      roles: ["mystery_shopper", "admin", "superadmin"],
    });
    if (!caller) return jsonError("No autorizado.", 401);

    const hotelResult = resolveRouteHotelScope(caller.profile, null);
    if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);

    // Admin can query a specific shopper; mystery_shopper always sees their own data
    let shopperId = caller.profile.id;
    if (caller.profile.role !== "mystery_shopper") {
      const qid = request.nextUrl.searchParams.get("shopper_id")?.trim();
      if (!qid) return jsonError("shopper_id es obligatorio.", 400);
      shopperId = qid;
    }

    const admin = supabaseAdmin();

    // Get all active areas + their active templates for this hotel
    const [{ data: areas, error: areasErr }, { data: runs, error: runsErr }, { data: shopperProfile }] = await Promise.all([
      admin
        .from("areas")
        .select("id, name, audit_templates(id, name, active)")
        .eq("hotel_id", hotelResult.hotelId)
        .eq("active", true),
      admin
        .from("audit_runs")
        .select("id, area_id, audit_template_id, status, score, executed_at")
        .eq("hotel_id", hotelResult.hotelId)
        .eq("executed_by", shopperId),
      admin
        .from("profiles")
        .select("access_expires_at")
        .eq("id", shopperId)
        .maybeSingle(),
    ]);

    if (areasErr) return jsonDbError(areasErr);
    if (runsErr) return jsonDbError(runsErr);

    // Index runs by template_id
    const runsByTemplate: Record<string, { id: string; status: string; score: number | null; executed_at: string | null }[]> = {};
    for (const run of runs ?? []) {
      const key = run.audit_template_id;
      if (!key) continue;
      if (!runsByTemplate[key]) runsByTemplate[key] = [];
      runsByTemplate[key].push({
        id: run.id,
        status: run.status ?? "draft",
        score: run.score ?? null,
        executed_at: run.executed_at ?? null,
      });
    }

    const progress = (areas ?? []).map((area: any) => {
      const templates = (area.audit_templates ?? []).filter((t: any) => t.active !== false);
      const templateProgress = templates.map((t: any) => {
        const areaRuns = runsByTemplate[t.id] ?? [];
        const submitted = areaRuns.filter((r) => r.status === "submitted");
        const draft = areaRuns.filter((r) => r.status === "draft");
        return {
          template_id: t.id,
          template_name: t.name,
          submitted_count: submitted.length,
          draft_count: draft.length,
          last_run: submitted[0] ?? draft[0] ?? null,
          done: submitted.length > 0,
        };
      });

      const totalTemplates = templateProgress.length;
      const doneTemplates = templateProgress.filter((t: any) => t.done).length;

      return {
        area_id: area.id,
        area_name: area.name,
        total_templates: totalTemplates,
        done_templates: doneTemplates,
        templates: templateProgress,
      };
    });

    const totalTemplates = progress.reduce((s, a) => s + a.total_templates, 0);
    const doneTemplates = progress.reduce((s, a) => s + a.done_templates, 0);

    return NextResponse.json({
      ok: true,
      shopper_id: shopperId,
      total_templates: totalTemplates,
      done_templates: doneTemplates,
      access_expires_at: shopperProfile?.access_expires_at ?? null,
      areas: progress,
    });
  } catch (error) {
    return jsonDbError(error instanceof Error ? { message: error.message } : null, "Error inesperado.");
  }
}