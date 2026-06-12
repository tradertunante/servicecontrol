import "server-only";

import { waitUntil } from "@vercel/functions";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logger } from "@/lib/logger";

// $/MTok por modelo (input, output). Si el modelo no está, se usa DEFAULT_PRICING
// y se loguea para añadirlo — mejor un coste aproximado que uno silenciosamente erróneo.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const DEFAULT_PRICING = { input: 3, output: 15 };

export function logApiCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  functionName: string,
  hotelId?: string
): void {
  // El SDK devuelve el id completo (p. ej. claude-sonnet-4-6-20251114)
  const pricing =
    MODEL_PRICING[model] ??
    Object.entries(MODEL_PRICING).find(([key]) => model.startsWith(key))?.[1];

  if (!pricing) {
    logger.warn("api_cost_unknown_model_pricing", { model, functionName });
  }

  const { input, output } = pricing ?? DEFAULT_PRICING;
  const cost = (inputTokens * input + outputTokens * output) / 1_000_000;

  // waitUntil mantiene viva la función serverless hasta completar el insert;
  // un fire-and-forget a secas pierde el log si la función se congela al responder.
  waitUntil(
    (async () => {
      const { error } = await supabaseAdmin().from("api_cost_logs").insert({
        hotel_id: hotelId ?? null,
        function_name: functionName,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: cost,
      });
      if (error) {
        await logger.error("api_cost_log_failed", { error: error.message, functionName });
      }
    })()
  );
}