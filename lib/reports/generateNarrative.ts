import "server-only";

import Anthropic from "@anthropic-ai/sdk";

export type AreaReportData = {
  name: string;
  score: number;
  prevScore: number | null;
  auditsCount: number;
  topFailures: string[]; // top 3 failing question texts
  openCorrectiveActions: number;
  overdueCorrectiveActions: number; // open > 7 days
};

export type ReportNarrativeInput = {
  hotelName: string;
  periodLabel: string;
  periodType: "weekly" | "monthly";
  overallScore: number;
  prevOverallScore: number | null;
  totalAudits: number;
  areas: AreaReportData[];
};

export type ReportNarrativeOutput = {
  hotel: string;
  areas: Record<string, string>; // area name → narrative
};

function buildPrompt(input: ReportNarrativeInput): string {
  const period = input.periodType === "weekly" ? "semana" : "mes";
  const prevLine = input.prevOverallScore != null
    ? `Score anterior: ${input.prevOverallScore.toFixed(1)}% (${(input.overallScore - input.prevOverallScore) >= 0 ? "+" : ""}${(input.overallScore - input.prevOverallScore).toFixed(1)} puntos)`
    : "Sin período anterior para comparar.";

  const areasBlock = input.areas.map(a => {
    const trend = a.prevScore != null
      ? ` (antes: ${a.prevScore.toFixed(1)}%, Δ${(a.score - a.prevScore) >= 0 ? "+" : ""}${(a.score - a.prevScore).toFixed(1)})`
      : "";
    const failures = a.topFailures.length > 0
      ? `Fallos más frecuentes: ${a.topFailures.map(f => `"${f}"`).join(", ")}.`
      : "Sin fallos registrados.";
    const correctives = a.openCorrectiveActions > 0
      ? `Correctivas abiertas: ${a.openCorrectiveActions}${a.overdueCorrectiveActions > 0 ? ` (${a.overdueCorrectiveActions} con más de 7 días sin cierre)` : ""}.`
      : "Sin correctivas abiertas.";
    return `- ${a.name}: ${a.score.toFixed(1)}%${trend} · ${a.auditsCount} auditoría(s). ${failures} ${correctives}`;
  }).join("\n");

  return `Eres el sistema de reporting de ServiceControl, plataforma de calidad hotelera. Escribe un resumen narrativo conciso y directo del reporte de ${period} del hotel "${input.hotelName}".

Datos del período (${input.periodLabel}):
- Score general: ${input.overallScore.toFixed(1)}%
- ${prevLine}
- Total auditorías: ${input.totalAudits}
- Áreas:
${areasBlock}

Instrucciones:
1. Escribe primero el resumen de NIVEL HOTEL (para el General Manager y Quality Manager): 3-4 frases. Destaca la tendencia general, el área con más problemas y si hay correctivas críticas sin cerrar. Tono: directo, sin adornos, orientado a acción.
2. Luego escribe un resumen de NIVEL ÁREA para CADA área (para el manager de área): 2-3 frases cada uno. Habla directamente al manager ("Tu área..."). Menciona el cambio vs. período anterior, el fallo más frecuente si hay, y si tiene correctivas pendientes.

Devuelve SOLO un JSON válido con esta estructura:
{
  "hotel": "texto del resumen hotel",
  "areas": {
    "nombre_área_exacto": "texto del resumen para ese manager",
    ...
  }
}

Sin texto adicional, sin markdown, solo el JSON.`;
}

export async function generateReportNarrative(
  input: ReportNarrativeInput
): Promise<ReportNarrativeOutput> {
  const envKey = "ANTHROPIC" + "_API_KEY";
  const apiKey = process.env[envKey];
  if (!apiKey) throw new Error("API de IA no configurada.");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: "Eres el sistema de análisis de calidad de ServiceControl. Respondes siempre en español, de forma concisa y orientada a la acción.",
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  const textBlock = message.content.find(b => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Respuesta AI inesperada.");
  }

  try {
    const raw = textBlock.text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("JSON no encontrado en respuesta AI.");
    const parsed = JSON.parse(raw.slice(start, end + 1)) as ReportNarrativeOutput;
    if (!parsed.hotel || typeof parsed.areas !== "object") throw new Error("Estructura AI inválida.");
    return parsed;
  } catch {
    // Fallback: return raw text as hotel narrative with empty areas
    return { hotel: textBlock.text.slice(0, 600), areas: {} };
  }
}