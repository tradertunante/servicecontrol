"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingPeriod = "monthly" | "annual";
type TierKey = "auditoria" | "operaciones" | "control";

type Tier = {
  key: TierKey;
  name: string;
  tagline: string;
  persona: string;
  modules: string[];
  features: string[];
  popular: boolean;
};

type QuizStep = "q_formaciones" | "q_it" | "q_manto" | "result";

type QuizAnswers = {
  formaciones: boolean | null;
  it: boolean | null;
  manto: boolean | null;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const TIERS: Tier[] = [
  {
    key: "auditoria",
    name: "Auditorías",
    tagline: "Digitaliza y estandariza tus inspecciones",
    persona: "Hoteles que dan sus primeros pasos en auditoría digital",
    modules: ["Core"],
    features: [
      "Checklists digitales por área y departamento",
      "Detección y seguimiento de incidencias",
      "Puntuación automática por auditoría",
      "Histórico y comparativas por periodo",
      "Reauditorías para verificar correcciones",
    ],
    popular: false,
  },
  {
    key: "operaciones",
    name: "Operaciones",
    tagline: "Cierra el ciclo: detecta, forma y resuelve",
    persona: "Hoteles que quieren que cada fallo genere acción inmediata",
    modules: ["Core", "Formación", "IT"],
    features: [
      "Todo lo del plan Auditorías",
      "Fallos vinculados a planes de formación del equipo",
      "IT gestiona su propio backlog de incidencias",
      "Seguimiento hasta cierre por departamento",
      "−10% por combinar módulos",
    ],
    popular: true,
  },
  {
    key: "control",
    name: "Control Total",
    tagline: "Toda la operación bajo un solo sistema",
    persona: "Propiedades con operativa compleja o equipos multidepartamento",
    modules: ["Core", "Formación", "IT", "Mantenimiento"],
    features: [
      "Todo lo del plan Operaciones",
      "Mantenimiento gestiona su backlog de obras y averías",
      "Trazabilidad auditoría → formación → mantenimiento",
      "Dashboard 360° de toda la operación",
      "−20% por bundle completo",
    ],
    popular: false,
  },
];

const QUIZ_STEPS: {
  key: QuizStep;
  question: string;
  hint: string;
  yes: string;
  no: string;
}[] = [
  {
    key: "q_formaciones",
    question: "¿Quieres que los fallos detectados generen planes de formación para el equipo?",
    hint: "Cuando la auditoría detecta un fallo recurrente, el sistema asigna una formación al responsable y verifica que se completa.",
    yes: "Sí, me interesa",
    no: "No por ahora",
  },
  {
    key: "q_it",
    question: "¿Quieres que IT gestione su propio backlog de incidencias dentro del sistema?",
    hint: "IT recibe los fallos que les corresponden, los gestiona desde su vista propia y los cierra cuando están resueltos.",
    yes: "Sí",
    no: "No",
  },
  {
    key: "q_manto",
    question: "¿Quieres incluir a Mantenimiento en el seguimiento de obras y averías?",
    hint: "Mantenimiento recibe los fallos de su área, gestiona el trabajo y cierra cada incidencia desde su propia vista.",
    yes: "Sí",
    no: "No",
  },
];

// ─── Logic ────────────────────────────────────────────────────────────────────

function getRecommendedTier(a: QuizAnswers): TierKey {
  if (a.manto) return "control";
  if (!a.formaciones && !a.it) return "auditoria";
  return "operaciones";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModuleBadge({
  label,
  inverted = false,
}: {
  label: string;
  inverted?: boolean;
}) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={
        inverted
          ? { background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.28)" }
          : { background: "#EBF3FC", color: "#185FA5", border: "1px solid #C3DCEE" }
      }
    >
      {label}
    </span>
  );
}

function TierCard({
  tier,
  period,
  highlighted,
}: {
  tier: Tier;
  period: BillingPeriod;
  highlighted: boolean;
}) {
  const isPop = tier.popular;
  const isHighlighted = highlighted && !isPop;

  return (
    <div
      className="relative flex flex-col rounded-[24px] p-6 lg:p-7"
      style={{
        background: isPop ? "#185FA5" : "var(--card-bg)",
        border: isPop
          ? "1px solid #185FA5"
          : isHighlighted
          ? "2px solid #185FA5"
          : "1px solid var(--border)",
        boxShadow: isPop
          ? "0 8px 32px rgba(24,95,165,0.25)"
          : isHighlighted
          ? "0 4px 20px rgba(24,95,165,0.12)"
          : "var(--shadow-lg)",
      }}
    >
      {isPop && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full bg-white px-4 py-1 text-xs font-bold text-[#185FA5] shadow-sm">
            Más popular
          </span>
        </div>
      )}
      {isHighlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full px-4 py-1 text-xs font-bold" style={{ background: "#185FA5", color: "white" }}>
            Recomendado para ti
          </span>
        </div>
      )}

      {/* Persona */}
      <div
        className="mb-3 text-[10px] font-semibold uppercase tracking-[1.5px] leading-4"
        style={{ color: isPop ? "rgba(255,255,255,0.65)" : "var(--text-secondary)" }}
      >
        {tier.persona}
      </div>

      {/* Name + tagline */}
      <h3
        className="text-2xl font-extrabold tracking-tight"
        style={{ color: isPop ? "white" : "var(--text)" }}
      >
        {tier.name}
      </h3>
      <p
        className="mt-1 text-sm font-medium"
        style={{ color: isPop ? "rgba(255,255,255,0.8)" : "var(--text-secondary)" }}
      >
        {tier.tagline}
      </p>

      {/* Price box */}
      <div
        className="my-5 rounded-[12px] px-4 py-3"
        style={{
          background: isPop ? "rgba(255,255,255,0.12)" : "var(--row-bg)",
          border: isPop ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border)",
        }}
      >
        <div
          className="text-[10px] font-semibold uppercase tracking-[1.5px]"
          style={{ color: isPop ? "rgba(255,255,255,0.55)" : "var(--text-secondary)" }}
        >
          Precio / mes
        </div>
        <div
          className="mt-0.5 text-lg font-bold"
          style={{ color: isPop ? "white" : "var(--text)" }}
        >
          Por definir
        </div>
        {period === "annual" && (
          <div
            className="mt-0.5 text-xs"
            style={{ color: isPop ? "rgba(255,255,255,0.6)" : "var(--text-secondary)" }}
          >
            Con pago anual · ~15% de descuento
          </div>
        )}
      </div>

      {/* Module badges */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {tier.modules.map((m) => (
          <ModuleBadge key={m} label={m} inverted={isPop} />
        ))}
      </div>

      {/* Feature list */}
      <ul className="mb-6 flex-1 space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: isPop ? "rgba(255,255,255,0.85)" : "#185FA5" }}
            >
              <path
                d="M3 8l3.5 3.5L13 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="text-sm leading-5"
              style={{ color: isPop ? "rgba(255,255,255,0.88)" : "var(--text-secondary)" }}
            >
              {f}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href="/demo"
        className="block rounded-[10px] px-5 py-3 text-center text-sm font-semibold transition"
        style={
          isPop
            ? { background: "white", color: "#185FA5" }
            : { background: "#185FA5", color: "white" }
        }
      >
        Ver demo · 30 min
      </Link>
    </div>
  );
}

function AnaliticaBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] p-5"
      style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
    >
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}
          >
            Add-on
          </span>
          <span className="text-sm font-bold text-[var(--text)]">Analítica avanzada</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Disponible en cualquier plan · Tendencias, comparativas entre áreas y exportes detallados. Descuento automático al combinar con otros módulos.
        </p>
      </div>
      <Link
        href="/demo"
        className="shrink-0 rounded-[8px] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:text-[#185FA5]"
        style={{ border: "1px solid var(--border)" }}
      >
        Preguntar por Analítica
      </Link>
    </div>
  );
}

function MultihotelBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] p-5"
      style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
    >
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: "#EBF3FC", color: "#185FA5", border: "1px solid #C3DCEE" }}
          >
            Cadena / Multihotel
          </span>
          <span className="text-sm font-bold text-[var(--text)]">Gestión de varias propiedades</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Cualquier plan con tarifa por propiedad adicional · Panel unificado para comparar resultados entre hoteles.
        </p>
      </div>
      <Link
        href="/demo"
        className="shrink-0 rounded-[8px] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:text-[#185FA5]"
        style={{ border: "1px solid var(--border)" }}
      >
        Hablar con ventas
      </Link>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PricingQuiz() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState<QuizStep>("q_formaciones");
  const [answers, setAnswers] = useState<QuizAnswers>({ formaciones: null, it: null, manto: null });
  const [recommendedTier, setRecommendedTier] = useState<TierKey | null>(null);

  const currentStepIndex = QUIZ_STEPS.findIndex((s) => s.key === quizStep);
  const currentStep = QUIZ_STEPS[currentStepIndex];

  function handleAnswer(value: boolean) {
    const key = currentStep.key.replace("q_", "") as keyof QuizAnswers;
    const next = QUIZ_STEPS[currentStepIndex + 1];
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    if (next) {
      setQuizStep(next.key);
    } else {
      setRecommendedTier(getRecommendedTier(updated));
      setQuizStep("result");
    }
  }

  function restartQuiz() {
    setQuizStep("q_formaciones");
    setAnswers({ formaciones: null, it: null, manto: null });
    setRecommendedTier(null);
  }

  return (
    <div className="space-y-6">

      {/* ── Billing toggle ── */}
      <div className="flex justify-center">
        <div
          className="inline-flex items-center rounded-full p-1 text-sm"
          style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setPeriod("monthly")}
            className="rounded-full px-5 py-1.5 font-semibold transition"
            style={
              period === "monthly"
                ? { background: "var(--card-bg)", color: "var(--text)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "var(--text-secondary)" }
            }
          >
            Mensual
          </button>
          <button
            onClick={() => setPeriod("annual")}
            className="flex items-center gap-2 rounded-full px-5 py-1.5 font-semibold transition"
            style={
              period === "annual"
                ? { background: "var(--card-bg)", color: "var(--text)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "var(--text-secondary)" }
            }
          >
            Anual
            <span className="rounded-full bg-[#15803D] px-2 py-0.5 text-[10px] font-bold text-white">
              −15%
            </span>
          </button>
        </div>
      </div>

      {/* ── Tier cards ── */}
      <div className="grid gap-6 pt-4 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <TierCard
            key={tier.key}
            tier={tier}
            period={period}
            highlighted={recommendedTier === tier.key}
          />
        ))}
      </div>

      {/* ── Add-ons ── */}
      <div className="space-y-3">
        <AnaliticaBanner />
        <MultihotelBanner />
      </div>

      {/* ── Quiz ── */}
      <div className="rounded-[20px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => setShowQuiz((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--row-bg)]"
        >
          <span>¿No sabes cuál elegir? Responde 3 preguntas y te lo decimos</span>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
            style={{ border: "1px solid var(--border)" }}
          >
            {showQuiz ? "−" : "+"}
          </span>
        </button>

        {showQuiz && (
          <div className="px-6 pb-6 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            {quizStep !== "result" ? (
              <>
                {/* Progress bar */}
                <div className="mb-6 flex items-center gap-2">
                  {QUIZ_STEPS.map((s, i) => (
                    <div
                      key={s.key}
                      className="h-1 flex-1 rounded-full transition-all"
                      style={{ background: i <= currentStepIndex ? "#185FA5" : "var(--border)" }}
                    />
                  ))}
                </div>

                <div className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-secondary)]">
                  Pregunta {currentStepIndex + 1} de {QUIZ_STEPS.length}
                </div>
                <h3 className="mt-2 text-lg font-bold text-[var(--text)]">
                  {currentStep.question}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {currentStep.hint}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => handleAnswer(true)}
                    className="rounded-[12px] px-5 py-3.5 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                    style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                  >
                    <span className="mr-2 text-[#185FA5]">→</span>
                    {currentStep.yes}
                  </button>
                  <button
                    onClick={() => handleAnswer(false)}
                    className="rounded-[12px] px-5 py-3.5 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                    style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                  >
                    <span className="mr-2 text-[var(--text-secondary)]">→</span>
                    {currentStep.no}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[2px] text-[#185FA5]">
                  Plan recomendado
                </div>
                {recommendedTier && (() => {
                  const tier = TIERS.find((t) => t.key === recommendedTier)!;
                  return (
                    <div
                      className="rounded-[16px] p-5"
                      style={{ background: "var(--row-bg)", border: "2px solid #185FA5" }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="text-xl font-extrabold text-[var(--text)]">{tier.name}</div>
                          <div className="mt-0.5 text-sm text-[var(--text-secondary)]">{tier.tagline}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {tier.modules.map((m) => (
                            <ModuleBadge key={m} label={m} />
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href="/demo"
                          className="rounded-[8px] bg-[#185FA5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#378ADD]"
                        >
                          Ver demo · 30 min
                        </Link>
                        <button
                          onClick={restartQuiz}
                          className="rounded-[8px] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text)]"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          Repetir
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}