"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingPeriod = "monthly" | "annual";
type TierKey = "auditoria" | "operaciones" | "control";
type ModuleKey = "core" | "training" | "analytics" | "it" | "maintenance";

type Tier = {
  key: TierKey;
  // moduleGroups: rows of badges — keeps IT+Mantenimiento on the same line in Control Total
  moduleGroups: ModuleKey[][];
  popular: boolean;
  monthlyPrice: number;
  annualPrice: number;
};

type QuizKey = "formaciones" | "depts";

type QuizAnswers = {
  formaciones: boolean | null;
  depts: boolean | null; // IT + Mantenimiento always as a pair
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const TIERS: Tier[] = [
  {
    key: "auditoria",
    moduleGroups: [["core"]],
    popular: false,
    monthlyPrice: 195,
    annualPrice: 165,
  },
  {
    key: "operaciones",
    moduleGroups: [["core", "training", "analytics"]],
    popular: true,
    monthlyPrice: 259,
    annualPrice: 220,
  },
  {
    key: "control",
    moduleGroups: [["core", "training", "analytics"], ["it", "maintenance"]],
    popular: false,
    monthlyPrice: 349,
    annualPrice: 295,
  },
];

const QUIZ_KEYS: QuizKey[] = ["formaciones", "depts"];

// ─── Logic ────────────────────────────────────────────────────────────────────

function getRecommendedTier(a: QuizAnswers): TierKey {
  if (a.depts) return "control";
  if (a.formaciones) return "operaciones";
  return "auditoria";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModuleBadge({ moduleKey, inverted = false }: { moduleKey: ModuleKey; inverted?: boolean }) {
  const t = useTranslations("pricingPage");
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={
        inverted
          ? { background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.28)" }
          : { background: "#EBF3FC", color: "#185FA5", border: "1px solid #C3DCEE" }
      }
    >
      {t(`modules.${moduleKey}`)}
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
  const t = useTranslations("pricingPage");
  const features = t.raw(`tiers.${tier.key}.features`) as string[];
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
            {t("popularBadge")}
          </span>
        </div>
      )}
      {isHighlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full px-4 py-1 text-xs font-bold" style={{ background: "#185FA5", color: "white" }}>
            {t("recommendedBadge")}
          </span>
        </div>
      )}

      {/* Persona */}
      <div
        className="mb-3 text-[10px] font-semibold uppercase tracking-[1.5px] leading-4"
        style={{ color: isPop ? "rgba(255,255,255,0.65)" : "var(--text-secondary)" }}
      >
        {t(`tiers.${tier.key}.persona`)}
      </div>

      {/* Name + tagline */}
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
          {period === "annual" ? t("annualPriceLabel") : t("monthlyPriceLabel")}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1" style={{ color: isPop ? "white" : "var(--text)" }}>
          <span className="text-2xl font-extrabold">
            €{period === "annual" ? tier.annualPrice : tier.monthlyPrice}
          </span>
          <span className="text-sm font-medium opacity-70">{t("perMonth")}</span>
        </div>
        {period === "annual" && (
          <div className="mt-0.5 text-xs" style={{ color: isPop ? "rgba(255,255,255,0.6)" : "var(--text-secondary)" }}>
            {t("annualBilledNote", { total: tier.annualPrice * 12 })}
          </div>
        )}
        {period === "monthly" && (
          <div className="mt-0.5 text-xs" style={{ color: isPop ? "rgba(255,255,255,0.6)" : "var(--text-secondary)" }}>
            {t("monthlyNote")}
          </div>
        )}
      </div>

      {/* Module badges — each group stays on its own line */}
      <div className="mb-5 space-y-1.5">
        {tier.moduleGroups.map((group, gi) => (
          <div key={gi} className="flex flex-wrap gap-1.5">
            {group.map((m) => (
              <ModuleBadge key={m} moduleKey={m} inverted={isPop} />
            ))}
          </div>
        ))}
      </div>

      {/* Feature list */}
      <ul className="mb-6 flex-1 space-y-2.5">
        {features.map((f) => (
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
        style={isPop ? { background: "white", color: "#185FA5" } : { background: "#185FA5", color: "white" }}
      >
        {t("ctaDemo")}
      </Link>
    </div>
  );
}

function MultihotelBanner() {
  const t = useTranslations("pricingPage");
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
        <p className="text-sm text-[var(--text-secondary)]">
          {t("multihotel.description")}
        </p>
      </div>
      <Link
        href="/demo"
        className="shrink-0 rounded-[8px] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:text-[#185FA5]"
        style={{ border: "1px solid var(--border)" }}
      >
        {t("multihotel.cta")}
      </Link>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PricingQuiz() {
  const t = useTranslations("pricingPage");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [showQuiz, setShowQuiz] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({ formaciones: null, depts: null });
  const [recommendedTier, setRecommendedTier] = useState<TierKey | null>(null);

  const isResult = stepIndex >= QUIZ_KEYS.length;
  const currentKey = isResult ? null : QUIZ_KEYS[stepIndex];

  function handleAnswer(value: boolean) {
    if (!currentKey) return;
    const updated = { ...answers, [currentKey]: value };
    setAnswers(updated);
    if (stepIndex + 1 < QUIZ_KEYS.length) {
      setStepIndex(stepIndex + 1);
    } else {
      setRecommendedTier(getRecommendedTier(updated));
      setStepIndex(QUIZ_KEYS.length);
    }
  }

  function restartQuiz() {
    setStepIndex(0);
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
            {t("billingMonthly")}
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
            {t("billingAnnual")}
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
            {!isResult && currentKey ? (
              <>
                <div className="mb-6 flex items-center gap-2">
                  {QUIZ_KEYS.map((key, i) => (
                    <div
                      key={key}
                      className="h-1 flex-1 rounded-full transition-all"
                      style={{ background: i <= stepIndex ? "#185FA5" : "var(--border)" }}
                    />
                  ))}
                </div>

                <div className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-secondary)]">
                  {t("quiz.stepLabel", { current: stepIndex + 1, total: QUIZ_KEYS.length })}
                </div>
                <h3 className="mt-2 text-lg font-bold text-[var(--text)]">
                  {t(`quiz.questions.${currentKey}.question`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`quiz.questions.${currentKey}.hint`)}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => handleAnswer(true)}
                    className="rounded-[12px] px-5 py-3.5 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                    style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                  >
                    <span className="mr-2 text-[#185FA5]">→</span>
                    {t(`quiz.questions.${currentKey}.yes`)}
                  </button>
                  <button
                    onClick={() => handleAnswer(false)}
                    className="rounded-[12px] px-5 py-3.5 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                    style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                  >
                    <span className="mr-2 text-[var(--text-secondary)]">→</span>
                    {t(`quiz.questions.${currentKey}.no`)}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[2px] text-[#185FA5]">
                  {t("quiz.resultLabel")}
                </div>
                {recommendedTier && (() => {
                  const tier = TIERS.find((tr) => tr.key === recommendedTier)!;
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
                                <ModuleBadge key={m} moduleKey={m} />
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
                          {t("ctaDemo")}
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

    </div>
  );
}
