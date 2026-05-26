import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError, jsonDbError } from "@/lib/api/response";

const RECENT_DAYS = 30;
const HISTORICAL_DAYS = 90;
const MIN_TOTAL_ANSWERS = 3;

type FailureRow = {
  area_id: string;
  area_name: string;
  question_id: string | null;
  question_text: string;
  recent_fail_count: number;
  recent_total: number;
  recent_ratio: number;
  historical_fail_count: number;
  historical_total: number;
  historical_ratio: number;
};

type AiSuggestion = {
  question_id: string | null;
  question_text: string;
  area_id: string;
  area_name: string;
  trigger_ratio: number;
  trigger_count: number;
  objective: string;
  procedure: string[];
  checklist: string[];
  questions: string[];
};

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function getFailureDataForHotel(hotelId: string): Promise<FailureRow[]> {
  const admin = supabaseAdmin();
  const now = new Date();
  const recentStart = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const historicalStart = new Date(
    now.getTime() - HISTORICAL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: recentRuns, error: recentError } = await admin
    .from("audit_runs")
    .select("id, area_id")
    .eq("hotel_id", hotelId)
    .eq("status", "submitted")
    .is("archived_at", null)
    .gte("executed_at", recentStart);
  if (recentError) throw recentError;

  const { data: historicalRuns, error: histError } = await admin
    .from("audit_runs")
    .select("id, area_id")
    .eq("hotel_id", hotelId)
    .eq("status", "submitted")
    .is("archived_at", null)
    .gte("executed_at", historicalStart);
  if (histError) throw histError;

  if (!recentRuns?.length) return [];

  const recentAreaById = new Map(recentRuns.map((r) => [r.id, r.area_id]));
  const historicalAreaById = new Map((historicalRuns ?? []).map((r) => [r.id, r.area_id]));

  const allAreaIds = Array.from(
    new Set([
      ...recentRuns.map((r) => r.area_id),
      ...(historicalRuns ?? []).map((r) => r.area_id),
    ])
  );
  const { data: areas } = await admin.from("areas").select("id, name").in("id", allAreaIds);
  const areaNameById = new Map((areas ?? []).map((a) => [String(a.id), String(a.name)]));

  const recentRunIds = recentRuns.map((r) => r.id);
  const historicalRunIds = (historicalRuns ?? []).map((r) => r.id);

  const { data: recentAnswers, error: raError } = await admin
    .from("audit_answers")
    .select("question_id, question_text, result, answer, audit_run_id")
    .in("audit_run_id", recentRunIds);
  if (raError) throw raError;

  const { data: historicalAnswers, error: haError } = historicalRunIds.length
    ? await admin
        .from("audit_answers")
        .select("question_id, question_text, result, answer, audit_run_id")
        .in("audit_run_id", historicalRunIds)
    : { data: [], error: null };
  if (haError) throw haError;

  type Stats = {
    fail: number;
    total: number;
    question_id: string | null;
    question_text: string;
    area_id: string;
  };

  function aggregate(
    answers: typeof recentAnswers,
    areaById: Map<string, string>
  ): Map<string, Stats> {
    const map = new Map<string, Stats>();
    for (const ans of answers ?? []) {
      const areaId = areaById.get(String(ans.audit_run_id));
      if (!areaId) continue;
      const qText = String(ans.question_text ?? ans.question_id ?? "").slice(0, 300);
      const key = `${areaId}::${ans.question_id ?? qText}`;
      const val = String(ans.result ?? ans.answer ?? "").toUpperCase();
      if (!["PASS", "FAIL"].includes(val)) continue;
      const s = map.get(key) ?? {
        fail: 0,
        total: 0,
        question_id: (ans.question_id as string | null) ?? null,
        question_text: qText,
        area_id: areaId,
      };
      s.total++;
      if (val === "FAIL") s.fail++;
      map.set(key, s);
    }
    return map;
  }

  const recentStats = aggregate(recentAnswers, recentAreaById);
  const historicalStats = aggregate(historicalAnswers, historicalAreaById);

  const result: FailureRow[] = [];
  for (const [key, recent] of recentStats) {
    if (recent.total < MIN_TOTAL_ANSWERS) continue;
    const hist = historicalStats.get(key);
    result.push({
      area_id: recent.area_id,
      area_name: areaNameById.get(recent.area_id) ?? recent.area_id,
      question_id: recent.question_id,
      question_text: recent.question_text,
      recent_fail_count: recent.fail,
      recent_total: recent.total,
      recent_ratio: Math.round((recent.fail / recent.total) * 100) / 100,
      historical_fail_count: hist?.fail ?? 0,
      historical_total: hist?.total ?? 0,
      historical_ratio: hist ? Math.round((hist.fail / hist.total) * 100) / 100 : 0,
    });
  }

  return result;
}

async function callAiForSuggestions(
  hotelName: string,
  failureData: FailureRow[]
): Promise<AiSuggestion[]> {
  const envKey = "ANTHROPIC" + "_API_KEY";
  const apiKey = process.env[envKey];
  if (!apiKey) throw new Error("API de IA no configurada.");

  const client = new Anthropic({ apiKey });

  const dataPayload = failureData
    .map(
      (row) =>
        `- Área: ${row.area_name} | Pregunta: "${row.question_text}" | Fallo reciente: ${Math.round(row.recent_ratio * 100)}% (${row.recent_fail_count}/${row.recent_total}) | Fallo histórico: ${Math.round(row.historical_ratio * 100)}% (${row.historical_fail_count}/${row.historical_total})`
    )
    .join("\n");

  const prompt = `Eres un experto en gestión de calidad hotelera. Analiza los datos de fallos de auditoría del hotel "${hotelName}" y decide qué patrones justifican una formación al equipo.

Datos de fallos por pregunta (últimos ${RECENT_DAYS} días vs. histórico ${HISTORICAL_DAYS} días):
${dataPayload}

Criterios orientativos para sugerir formación:
- Ratio de fallo reciente >= 40% con al menos ${MIN_TOTAL_ANSWERS} evaluaciones
- O ratio reciente significativamente mayor que el histórico (regresión clara)
- Ignorar fallos esporádicos o aislados sin patrón

Para cada patrón que merece formación, devuelve un objeto JSON con:
- question_text: el texto exacto de la pregunta del input
- area_name: el nombre del área exacto del input
- objective: qué debe aprender el equipo (1-2 frases directas y prácticas)
- procedure: array de 3-5 pasos de protocolo a seguir
- checklist: array de 3-5 puntos de verificación práctica
- questions: array de 2-3 preguntas para evaluar comprensión

Devuelve SOLO un array JSON válido (puede ser vacío []). Sin texto adicional, sin markdown.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  let parsed: Array<{
    question_text: string;
    area_name: string;
    objective: string;
    procedure: string[];
    checklist: string[];
    questions: string[];
  }>;

  try {
    const raw = textBlock.text.trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }

  const byAreaQuestion = new Map(
    failureData.map((row) => [`${row.area_name}::${row.question_text}`, row])
  );

  return (parsed ?? [])
    .map((s) => {
      const match = byAreaQuestion.get(`${s.area_name}::${s.question_text}`);
      if (!match) return null;
      return {
        question_id: match.question_id,
        question_text: s.question_text,
        area_id: match.area_id,
        area_name: s.area_name,
        trigger_ratio: match.recent_ratio,
        trigger_count: match.recent_fail_count,
        objective: s.objective ?? "",
        procedure: Array.isArray(s.procedure) ? s.procedure : [],
        checklist: Array.isArray(s.checklist) ? s.checklist : [],
        questions: Array.isArray(s.questions) ? s.questions : [],
      };
    })
    .filter((s): s is AiSuggestion => s !== null);
}

async function processSuggestionsForHotel(
  hotelId: string,
  hotelName: string
): Promise<{ created: number; skipped: number }> {
  const admin = supabaseAdmin();

  const failureData = await getFailureDataForHotel(hotelId);
  if (failureData.length === 0) return { created: 0, skipped: 0 };

  const suggestions = await callAiForSuggestions(hotelName, failureData);
  if (suggestions.length === 0) return { created: 0, skipped: 0 };

  // Skip questions already with a pending/approved suggestion in the last 30 days
  const recentStart = new Date(
    Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: existing } = await admin
    .from("ai_training_suggestions")
    .select("area_id, question_text")
    .eq("hotel_id", hotelId)
    .in("review_status", ["pending", "approved"])
    .gte("created_at", recentStart);

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.area_id}::${e.question_text}`)
  );

  let created = 0;
  let skipped = 0;

  for (const s of suggestions) {
    const key = `${s.area_id}::${s.question_text}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const { error: insertError } = await admin.from("ai_training_suggestions").insert({
      hotel_id: hotelId,
      area_id: s.area_id,
      question_id: s.question_id,
      question_text: s.question_text,
      trigger_ratio: s.trigger_ratio,
      trigger_count: s.trigger_count,
      trigger_period_days: RECENT_DAYS,
      ai_content: {
        objective: s.objective,
        procedure: s.procedure,
        checklist: s.checklist,
        questions: s.questions,
      },
      review_status: "pending",
    });

    if (insertError) {
      skipped++;
      continue;
    }

    created++;

    // Notify area managers
    const { data: managers } = await admin
      .from("profiles")
      .select("id")
      .eq("hotel_id", hotelId)
      .eq("role", "manager");

    for (const mgr of managers ?? []) {
      if (!mgr.id) continue;
      await admin.rpc("notify_user", {
        p_hotel_id: hotelId,
        p_user_id: mgr.id,
        p_type: "training_suggestion_pending",
        p_title: "Nueva sugerencia de formación",
        p_body: `El sistema detectó un patrón de fallos en "${s.area_name}" que puede requerir formación.`,
        p_link: `/trainings?tab=suggestions`,
      });
    }
  }

  return { created, skipped };
}

/**
 * POST /api/trainings/generate-suggestions
 * Vercel cron (Monday 8am UTC) or manual admin/gm trigger with { hotel_id }.
 * Analyzes audit failure ratios and generates AI training suggestions for managers to review.
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    const isAuthorizedCron =
      cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

    const admin = supabaseAdmin();
    let hotelIds: string[] = [];

    if (isAuthorizedCron) {
      const { data: hotels, error } = await admin
        .from("hotels")
        .select("id")
        .eq("is_active", true);
      if (error) return jsonDbError(error);
      hotelIds = (hotels ?? []).map((h) => h.id);
    } else {
      const caller = await authorizeRouteRequest(request, {
        roles: ["admin", "general_manager"],
      });
      if (!caller) return jsonError("No autorizado.", 401);

      const hotelResult = resolveRouteHotelScope(caller.profile, null);
      if (!hotelResult.ok) return jsonError(hotelResult.error, hotelResult.status);
      hotelIds = [hotelResult.hotelId];
    }

    const { data: hotels } = await admin
      .from("hotels")
      .select("id, name")
      .in("id", hotelIds);
    const hotelNameById = new Map((hotels ?? []).map((h) => [h.id, h.name]));

    const results: {
      hotel_id: string;
      created: number;
      skipped: number;
      error?: string;
    }[] = [];

    for (const hotelId of hotelIds) {
      try {
        const { created, skipped } = await processSuggestionsForHotel(
          hotelId,
          hotelNameById.get(hotelId) ?? "Hotel"
        );
        results.push({ hotel_id: hotelId, created, skipped });
      } catch (err) {
        results.push({
          hotel_id: hotelId,
          created: 0,
          skipped: 0,
          error: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }

    const totalCreated = results.reduce((s, r) => s + r.created, 0);
    return jsonNoStore({ ok: true, totalCreated, results });
  } catch (error) {
    return jsonDbError(
      error instanceof Error ? { message: error.message } : null,
      "Error inesperado."
    );
  }
}