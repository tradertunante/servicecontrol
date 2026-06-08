import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const INPUT_COST_PER_TOK = 3 / 1_000_000; // $3/MTok (claude-sonnet-4)
const OUTPUT_COST_PER_TOK = 15 / 1_000_000; // $15/MTok (claude-sonnet-4)

let sessionTotal = 0;

export function logApiCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  functionName: string,
  hotelId?: string
): void {
  const cost = inputTokens * INPUT_COST_PER_TOK + outputTokens * OUTPUT_COST_PER_TOK;
  sessionTotal += cost;
  console.log(
    `[API Cost] ${model} | in: ${inputTokens} tokens | out: ${outputTokens} tokens | $${cost.toFixed(6)} | session total: $${sessionTotal.toFixed(6)}`
  );

  // Fire-and-forget — no bloquea la respuesta
  supabaseAdmin()
    .from("api_cost_logs")
    .insert({
      hotel_id: hotelId ?? null,
      function_name: functionName,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error("[API Cost] Error guardando log:", error.message);
    });
}