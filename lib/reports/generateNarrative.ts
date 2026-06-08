import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { logApiCost } from "@/lib/ai/costLogger";

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
  input: ReportNarrativeInput,
  hotelId?: string
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
  logApiCost(message.model, message.usage.input_tokens, message.usage.output_tokens, "report-narrative", hotelId);

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

export type MysteryShopperAnswerData = {
  question: string;
  tag: string | null;
  classification: string | null;
  weight: number;
  passed: boolean;
  na: boolean;
  comment: string | null;
  has_photo: boolean;
};

export type MysteryShopperRunData = {
  area: string;
  template: string;
  score: number | null;
  date: string | null;
  room_number: string | null;
  answers: MysteryShopperAnswerData[];
};

export async function generateMysteryShopperNarrative(
  input: {
    hotelName: string;
    shopperName: string;
    totalRuns: number;
    avgScore: number | null;
    runs: MysteryShopperRunData[];
  },
  hotelId?: string
): Promise<string> {
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

      const answersBlock = r.answers
        .filter((a) => !a.na)
        .map((a) => {
          const icon = a.passed ? "✓" : "✗";
          const tag = a.tag ? `[${a.tag}]` : "";
          const cls = a.classification ? `[${a.classification}]` : "";
          const comment = a.comment ? ` → "${a.comment}"` : "";
          const photo = a.has_photo ? " 📷" : "";
          return `    ${icon} ${cls}${tag} ${a.question}${comment}${photo}`;
        })
        .join("\n");

      return `${r.area} — ${r.template}${room}: ${score}\n${answersBlock}`;
    })
    .join("\n\n");

  const prompt = `Eres un analista experto en experiencia de huésped en hoteles de lujo. Tu tarea es interpretar el reporte completo de un Mystery Shopper que se hospedó en "${input.hotelName}".

CONTEXTO:
- Esto es la experiencia COMPLETA de UN huésped real de principio a fin, no un reporte operativo de equipo.
- Cada línea con ✗ es un estándar que el huésped NO vivió correctamente. Cada ✓ es un estándar cumplido.
- Los comentarios tras "→" son observaciones directas del shopper en ese momento.
- Las clasificaciones [Behavioral/Physical/Procedural/etc.] y tags indican el tipo de estándar fallado.

DATOS COMPLETOS DE LA ESTANCIA (cronológicos):
${runsBlock}

Score medio global: ${input.avgScore !== null ? `${input.avgScore}%` : "no disponible"}
Total de touchpoints evaluados: ${input.totalRuns}

INSTRUCCIONES:
Escribe un análisis ejecutivo en español, en UN párrafo continuo de 5-7 frases, dirigido a la Dirección General y al Director de Calidad. Usa la estructura de feedback sandwich:

1. APERTURA POSITIVA: Empieza reconociendo lo que funcionó bien —estándares cumplidos, momentos del journey que sí estuvieron a la altura, comportamientos del equipo que destacaron—. Si hay poco positivo, menciona al menos la base funcional o los touchpoints sin incidencias.
2. CUERPO CRÍTICO: Desarrolla los fallos y sus patrones. ¿Se concentran en una clasificación (Behavioral, Physical, Procedural)? ¿En un momento del journey (llegada, habitación, salida)? Cita 1-2 fallos concretos con sus comentarios para ilustrar el impacto real. Distingue fallos críticos de secundarios.
3. CIERRE POSITIVO: Cierra reconociendo el potencial del hotel, los momentos que demuestran que el nivel de lujo es alcanzable, o que la base para mejorar existe. Tono esperanzador pero honesto.

RESTRICCIONES — NO NEGOCIABLES:
- NO menciones fechas ni rangos de fechas en ningún momento.
- NO asumas consecuencias que no estén explícitamente descritas en los comentarios. Si un fallo menciona "almohada extra sucia", no inferas que el huésped durmió sobre ella. Describe solo lo que el shopper observó o reportó literalmente, sin extrapolaciones.
- NO des recomendaciones, planes de acción, ni acciones prioritarias. Ni al final ni en medio del párrafo. Tu único trabajo es describir lo que ocurrió y los patrones que se observan. Si terminas con una frase que empiece por "La acción", "El siguiente paso", "Es necesario", "Se debe", "Hay que" o similar, elimínala.

Tono: consultor de experiencia de huésped hablando a un GM. Directo, sin listas, texto fluido.
Devuelve SOLO el texto del análisis, sin títulos ni explicaciones.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "Eres un analista experto en experiencia de huésped en hoteles de lujo. Respondes siempre en español. Tu análisis es conciso, accionable y habla desde la perspectiva del huésped, no desde métricas operativas.",
    messages: [{ role: "user", content: prompt }],
  });
  logApiCost(message.model, message.usage.input_tokens, message.usage.output_tokens, "mystery-shopper", hotelId);

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Respuesta AI inesperada.");
  return stripRecommendationSentence(textBlock.text.trim());
}

const RECOMMENDATION_PATTERNS = [
  /^la acci[oó]n prioritaria/i,
  /^la acci[oó]n inmediata/i,
  /^el siguiente paso/i,
  /^es necesario/i,
  /^es prioritario/i,
  /^es imprescindible/i,
  /^es innegociable/i,
  /^urge /i,
  /^resulta imprescindible/i,
  /^la prioridad/i,
  /^se debe /i,
  /^hay que /i,
  /^para revertir/i,
  /^el paso inmediato/i,
];

function stripRecommendationSentence(text: string): string {
  // Split into sentences on ". " boundaries, keeping the delimiter
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  if (sentences.length <= 1) return text;

  const last = sentences[sentences.length - 1].trim();
  const isRecommendation = RECOMMENDATION_PATTERNS.some((re) => re.test(last));

  if (isRecommendation) {
    return sentences.slice(0, -1).join("").trim();
  }
  return text;
}