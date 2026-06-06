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
  const apiKey = process.env.ANTHROPIC_API_KEY;
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

export type MysteryShopperRunData = {
  area: string;
  template: string;
  score: number | null;
  date: string | null;
  room_number: string | null;
};

export async function generateMysteryShopperNarrative(input: {
  hotelName: string;
  shopperName: string;
  totalRuns: number;
  avgScore: number | null;
  runs: MysteryShopperRunData[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("API de IA no configurada.");

  const client = new Anthropic({ apiKey });

  // Sort runs chronologically to reconstruct the guest journey
  const sortedRuns = [...input.runs].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const runsBlock = sortedRuns
    .map((r) => {
      const score = r.score !== null ? `${r.score}%` : "sin score";
      const room = r.room_number ? ` · habitación ${r.room_number}` : "";
      const date = r.date
        ? new Date(r.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "fecha desconocida";
      return `[${date}] ${r.area} — ${r.template}${room}: ${score}`;
    })
    .join("\n");

  const stayDates = sortedRuns
    .filter((r) => r.date)
    .map((r) => new Date(r.date!).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }));
  const stayRange = stayDates.length > 0
    ? stayDates.length > 1 ? `del ${stayDates[0]} al ${stayDates[stayDates.length - 1]}` : stayDates[0]
    : "fechas no disponibles";

  const prompt = `Eres un analista experto en experiencia de huésped en hoteles de lujo. Tu tarea es interpretar el reporte de un Mystery Shopper que se hospedó en "${input.hotelName}" ${stayRange} y auditó distintos puntos de contacto a lo largo de su estancia.

CONTEXTO IMPORTANTE:
- Esto NO es un reporte operativo semanal de auditorías múltiples. Es la experiencia COMPLETA de UN huésped real que vivió el hotel de principio a fin.
- Las puntuaciones reflejan cómo el huésped experimentó cada servicio, no métricas internas de equipo.
- El análisis debe leer como una evaluación de la experiencia del huésped, no como un control de calidad interno.

DATOS DE LA ESTANCIA (ordenados cronológicamente):
${runsBlock}

Score medio de la estancia: ${input.avgScore !== null ? `${input.avgScore}%` : "no disponible"}
Total de touchpoints evaluados: ${input.totalRuns}

INSTRUCCIONES PARA EL ANÁLISIS:
Escribe un análisis ejecutivo en español, en 1 párrafo continuo de 5-7 frases, dirigido a la Dirección General y al Director de Calidad del hotel. El análisis debe:
1. Describir cómo fue la experiencia global del huésped durante la estancia (no solo el número)
2. Destacar los momentos más destacados del journey (qué sorprendió positivamente)
3. Identificar las fricciones o caídas de experiencia más relevantes en el journey del huésped (no solo la lista de scores bajos, sino qué impacto tienen en la percepción del huésped)
4. Señalar si los puntos débiles son puntos de contacto críticos (primera impresión, salida, servicio en habitación) o secundarios
5. Cerrar con UNA sola acción prioritaria concreta y accionable

Tono: analítico, directo, orientado a decisión. Escribe como si fueras un consultor de experiencia de huésped hablando a un GM. Sin listas, solo texto fluido.
Devuelve SOLO el texto del análisis, sin títulos ni explicaciones adicionales.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "Eres un analista experto en experiencia de huésped en hoteles de lujo. Respondes siempre en español. Tu análisis es conciso, accionable y habla desde la perspectiva del huésped, no desde métricas operativas.",
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Respuesta AI inesperada.");
  return textBlock.text.trim();
}