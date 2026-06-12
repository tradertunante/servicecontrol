"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingPeriod = "monthly" | "annual";
type TierKey = "auditoria" | "operaciones" | "control";
type QuizStep = "q_formaciones" | "q_depts" | "result";

type TierData = {
  key: TierKey;
  moduleGroups: string[][];
  popular: boolean;
  monthlyPrice: number;
  annualPrice: number;
};

type QuizAnswers = {
  formaciones: boolean | null;
  depts: boolean | null;
};

// ─── Structural data (no strings) ─────────────────────────────────────────────

const TIERS: TierData[] = [
  {
    key: "auditoria",
    moduleGroups: [["Core"]],
    popular: false,
    monthlyPrice: 195,
    annualPrice: 165,
  },
  {
    key: "operaciones",
    moduleGroups: [["Core", "Formación", "Analítica"]],
    popular: true,
    monthlyPrice: 259,
    annualPrice: 220,
  },
  {
    key: "control",
    moduleGroups: [["Core", "Formación", "Analítica"], ["IT", "Mantenimiento"]],
    popular: false,
    monthlyPrice: 349,
    annualPrice: 295,
  },
];

const QUIZ_STEP_KEYS: Exclude<QuizStep, "result">[] = ["q_formaciones", "q_depts"];

const FAQ_KEYS = ["permanencia", "config", "multihotel", "cambio", "instalar", "datos"] as const;

// ─── Logic ────────────────────────────────────────────────────────────────────

function getRecommendedTier(a: QuizAnswers): TierKey {
  if (a.depts) return "control";
  if (a.formaciones) return "operaciones";
  return "auditoria";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModuleBadge({ label, inverted = false }: { label: string; inverted?: boolean }) {
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
  tier: TierData;
  period: BillingPeriod;
  highlighted: boolean;
}) {
  const t = useTranslations("pricing");
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
            {t("badge.popular")}
          </span>
        </div>
      )}
      {isHighlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full px-4 py-1 text-xs font-bold" style={{ background: "#185FA5", color: "white" }}>
            {t("badge.recommended")}
          </span>
        </div>
      )}

      <div
        className="mb-3 text-[10px] font-semibold uppercase tracking-[1.5px] leading-4"
        style={{ color: isPop ? "rgba(255,255,255,0.65)" : "var(--text-secondary)" }}
      >
        {t(`tiers.${tier.key}.persona`)}
      </div>

      <h3
        className="text-2xl font-extrabold tracking-tight"
        style={{ color: isPop ? "white" : "var(--text)" }}
      >
        {t(`tiers.${tier.key}.name`)}
      </h3>
      <p
        className="mt-1 text-sm font-medium"
        style={{ color: isPop ? "rgba(255,255,255,0.8)" : "var(--text-secondary)" }}
      >
        {t(`tiers.${tier.key}.tagline`)}
      </p>

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
          {period === "annual" ? t("billing.annualLabel") : t("billing.monthlyLabel")}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1" style={{ color: isPop ? "white" : "var(--text)" }}>
          <span className="text-2xl font-extrabold">
            €{period === "annual" ? tier.annualPrice : tier.monthlyPrice}
          </span>
          <span className="text-sm font-medium opacity-70">{t("billing.perMonth")}</span>
        </div>
        {period === "annual" && (
          <div className="mt-0.5 text-xs" style={{ color: isPop ? "rgba(255,255,255,0.6)" : "var(--text-secondary)" }}>
            {t("billing.annualBilled", { total: tier.annualPrice * 12 })}
          </div>
        )}
        {period === "monthly" && (
          <div className="mt-0.5 text-xs" style={{ color: isPop ? "rgba(255,255,255,0.6)" : "var(--text-secondary)" }}>
            {t("billing.noContract")}
          </div>
        )}
      </div>

      <div className="mb-5 space-y-1.5">
        {tier.moduleGroups.map((group, gi) => (
          <div key={gi} className="flex flex-wrap gap-1.5">
            {group.map((m) => (
              <ModuleBadge key={m} label={m} inverted={isPop} />
            ))}
          </div>
        ))}
      </div>

      <ul className="mb-6 flex-1 space-y-2.5">
        {(t.raw(`tiers.${tier.key}.features`) as string[]).map((f) => (
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

      <Link
        href="/demo"
        className="block rounded-[10px] px-5 py-3 text-center text-sm font-semibold transition"
        style={isPop ? { background: "white", color: "#185FA5" } : { background: "#185FA5", color: "white" }}
      >
        {t("cta.demo")}
      </Link>
    </div>
  );
}

function MultihotelBanner() {
  const t = useTranslations("pricing");
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
            {t("multihotel.badge")}
          </span>
          <span className="text-sm font-bold text-[var(--text)]">{t("multihotel.title")}</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{t("multihotel.desc")}</p>
      </div>
      <Link
        href="/demo"
        className="shrink-0 rounded-[8px] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:text-[#185FA5]"
        style={{ border: "1px solid var(--border)" }}
      >
        {t("cta.sales")}
      </Link>
    </div>
  );
}

function FaqAccordion() {
  const t = useTranslations("pricing");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="mt-16">
      <h2 className="mb-8 text-center text-2xl font-extrabold tracking-tight text-[var(--text)]">
        {t("faq.title")}
      </h2>
      <div className="mx-auto max-w-2xl divide-y" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        {FAQ_KEYS.map((key) => {
          const isOpen = open === key;
          return (
            <div key={key}>
              <button
                onClick={() => setOpen(isOpen ? null : key)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-[var(--text)] transition hover:text-[#185FA5]"
              >
                <span>{t(`faq.${key}_q`)}</span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-transform"
                  style={{
                    border: "1px solid var(--border)",
                    transform: isOpen ? "rotate(45deg)" : "none",
                  }}
                >
                  +
                </span>
              </button>
              {isOpen && (
                <p className="pb-4 text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`faq.${key}_a`)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PricingQuiz() {
  const t = useTranslations("pricing");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState<QuizStep>("q_formaciones");
  const [answers, setAnswers] = useState<QuizAnswers>({ formaciones: null, depts: null });
  const [recommendedTier, setRecommendedTier] = useState<TierKey | null>(null);

  const currentStepIndex = QUIZ_STEP_KEYS.indexOf(quizStep as Exclude<QuizStep, "result">);
  const currentStepKey = quizStep as Exclude<QuizStep, "result">;

  function handleAnswer(value: boolean) {
    const answerKey = currentStepKey.replace("q_", "") as keyof QuizAnswers;
    const nextKey = QUIZ_STEP_KEYS[currentStepIndex + 1];
    const updated = { ...answers, [answerKey]: value };
    setAnswers(updated);
    if (nextKey) {
      setQuizStep(nextKey);
    } else {
      setRecommendedTier(getRecommendedTier(updated));
      setQuizStep("result");
    }
  }

  function restartQuiz() {
    setQuizStep("q_formaciones");
    setAnswers({ formaciones: null, depts: null });
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
            {t("billing.monthly")}
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
            {t("billing.annual")}
            <span className="rounded-full bg-[#15803D] px-2 py-0.5 text-[10px] font-bold text-white">
              {t("billing.annualSavings")}
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
        <MultihotelBanner />
      </div>

      {/* ── Quiz ── */}
      <div className="overflow-hidden rounded-[20px]" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => setShowQuiz((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--row-bg)]"
        >
          <span>{t("quiz.toggle")}</span>
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
                <div className="mb-6 flex items-center gap-2">
                  {QUIZ_STEP_KEYS.map((s, i) => (
                    <div
                      key={s}
                      className="h-1 flex-1 rounded-full transition-all"
                      style={{ background: i <= currentStepIndex ? "#185FA5" : "var(--border)" }}
                    />
                  ))}
                </div>

                <div className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-secondary)]">
                  {t("quiz.stepLabel", { current: currentStepIndex + 1, total: QUIZ_STEP_KEYS.length })}
                </div>
                <h3 className="mt-2 text-lg font-bold text-[var(--text)]">
                  {t(`quiz.steps.${currentStepKey}.question`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`quiz.steps.${currentStepKey}.hint`)}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => handleAnswer(true)}
                    className="rounded-[12px] px-5 py-3.5 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                    style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                  >
                    <span className="mr-2 text-[#185FA5]">→</span>
                    {t(`quiz.steps.${currentStepKey}.yes`)}
                  </button>
                  <button
                    onClick={() => handleAnswer(false)}
                    className="rounded-[12px] px-5 py-3.5 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                    style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                  >
                    <span className="mr-2 text-[var(--text-secondary)]">→</span>
                    {t(`quiz.steps.${currentStepKey}.no`)}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[2px] text-[#185FA5]">
                  {t("quiz.recommended")}
                </div>
                {recommendedTier && (() => {
                  const tier = TIERS.find((t) => t.key === recommendedTier)!;
                  return (
                    <div
                      className="rounded-[16px] p-5"
                      style={{ background: "var(--row-bg)", border: "2px solid #185FA5" }}
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-extrabold text-[var(--text)]">
                            {t(`tiers.${tier.key}.name`)}
                          </div>
                          <div className="mt-0.5 text-sm text-[var(--text-secondary)]">
                            {t(`tiers.${tier.key}.tagline`)}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {tier.moduleGroups.map((group, gi) => (
                            <div key={gi} className="flex flex-wrap gap-1.5">
                              {group.map((m) => (
                                <ModuleBadge key={m} label={m} />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href="/demo"
                          className="rounded-[8px] bg-[#185FA5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#378ADD]"
                        >
                          {t("cta.demo")}
                        </Link>
                        <button
                          onClick={restartQuiz}
                          className="rounded-[8px] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text)]"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          {t("quiz.restart")}
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

      {/* ── FAQ ── */}
      <FaqAccordion />

    </div>
  );
}