/**
 * Catálogo canónico de planes — la única fuente de precios de la app.
 * Debe coincidir con lo publicado en la landing (PricingQuiz) y con los
 * Prices de Stripe (lookup_key = `${code}_${month|year}`); ver
 * scripts/stripe-sync-plans.js para crearlos/sincronizarlos.
 *
 * Client-safe: sin imports de servidor.
 */

export type PlanCode = "auditoria" | "operaciones" | "control";

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  tagline: string;
  /** €/mes con facturación mensual */
  monthly: number;
  /** €/mes con facturación anual (se factura annual*12 al año) */
  annual: number;
  highlight: boolean;
  features: string[];
  /** Packs de módulos que se activan en el hotel con este plan */
  enabledPacks: string[];
};

export const PLANS: PlanDefinition[] = [
  {
    code: "auditoria",
    name: "Auditorías",
    tagline: "Digitaliza y estandariza tus inspecciones",
    monthly: 195,
    annual: 165,
    highlight: false,
    features: [
      "Checklists digitales por área y departamento",
      "Detección y seguimiento de incidencias",
      "Puntuación automática por auditoría",
      "Histórico y comparativas por periodo",
      "Reauditorías para verificar correcciones",
    ],
    enabledPacks: ["base", "pack2"],
  },
  {
    code: "operaciones",
    name: "Operaciones",
    tagline: "Detecta, forma y analiza en un solo sistema",
    monthly: 259,
    annual: 220,
    highlight: true,
    features: [
      "Todo lo del plan Auditorías",
      "Fallos vinculados a planes de formación del equipo",
      "Asignación de formaciones con seguimiento hasta completado",
      "Dashboards avanzados, tendencias y exportes por área",
    ],
    enabledPacks: ["base", "pack1", "pack2", "pack3"],
  },
  {
    code: "control",
    name: "Control Total",
    tagline: "Toda la operación bajo un solo sistema",
    monthly: 349,
    annual: 295,
    highlight: false,
    features: [
      "Todo lo del plan Operaciones",
      "IT y Mantenimiento gestionan sus propios backlogs",
      "Trazabilidad auditoría → formación → mantenimiento",
      "Dashboard 360° de toda la operación",
    ],
    enabledPacks: ["base", "pack1", "pack_it", "pack_engineering", "pack2", "pack3"],
  },
];

export const PLAN_CODES: PlanCode[] = PLANS.map((p) => p.code);

export function getPlan(code: string): PlanDefinition | null {
  return PLANS.find((p) => p.code === code) ?? null;
}
