import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";
import CalEmbed from "@/app/(marketing)/_components/CalEmbed";
import { PLANS } from "@/lib/billing/plans";
import { localeAlternates } from "@/lib/marketingSeo";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "foundersPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(params.locale, "/founders"),
  };
}

function founderPrice(monthly: number) {
  return Math.floor(monthly / 2);
}

function FoundersPageContent({ locale }: { locale: string }) {
  const t = useTranslations("foundersPage");
  const offerItems = t.raw("offerItems") as string[];
  const askItems = t.raw("askItems") as string[];
  const fitYes = t.raw("fitYes") as string[];
  const fitNo = t.raw("fitNo") as string[];

  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <section className="space-y-6">
            <div
              className="rounded-[28px] p-8 text-white lg:p-10"
              style={{
                background: "rgba(15,23,42,0.96)",
                border: "1px solid var(--dark-border-subtle)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/60">
                {t("offerLabel")}
              </div>
              <div className="mt-4 text-2xl font-bold tracking-tight lg:text-3xl">
                {t("offerTitle")}
              </div>
              <ul className="mt-6 space-y-4 text-base leading-7 text-[var(--dark-text-muted)]">
                {offerItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="mt-[2px] text-emerald-400">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {PLANS.map((plan) => (
                  <div
                    key={plan.code}
                    className="rounded-[16px] p-5"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <div className="text-sm font-bold text-white/80">{plan.name}</div>
                    <div className="mt-2 text-2xl font-bold tracking-tight">
                      €{founderPrice(plan.monthly)}
                      <span className="text-sm font-normal text-white/60">{t("perMonth")}</span>
                    </div>
                    <div className="mt-1 text-sm text-white/50">
                      {t("insteadOf", { price: plan.monthly })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-white/50">{t("pricingNote")}</p>
            </div>

            <div
              className="rounded-[28px] p-8 lg:p-10"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                {t("askLabel")}
              </div>
              <div className="mt-4 text-2xl font-bold tracking-tight text-[var(--text)]">
                {t("askTitle")}
              </div>
              <ul className="mt-5 space-y-3 text-base leading-7 text-[var(--text-secondary)]">
                {askItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="mt-[2px] text-[var(--text)]">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                <div
                  className="rounded-[20px] p-6"
                  style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    {t("fitYesTitle")}
                  </div>
                  <ul className="mt-4 space-y-3 text-base leading-7 text-[var(--text-secondary)]">
                    {fitYes.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span aria-hidden className="mt-[2px] text-emerald-600">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  className="rounded-[20px] p-6"
                  style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    {t("fitNoTitle")}
                  </div>
                  <ul className="mt-4 space-y-3 text-base leading-7 text-[var(--text-secondary)]">
                    {fitNo.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span aria-hidden className="mt-[2px] text-[var(--text-secondary)]">✕</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-8 text-base font-semibold leading-7 text-[var(--text)]">
                {t("spotsNote")}
              </p>
            </div>
          </section>

          <aside
            className="flex flex-col overflow-hidden rounded-[28px]"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="px-8 pb-6 pt-8" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                {t("ctaLabel")}
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">
                {t("ctaTitle")}
              </div>
              <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">
                {t("ctaDescription")}
              </p>
            </div>
            <div className="flex-1">
              <CalEmbed locale={locale} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default async function FoundersPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  setRequestLocale(params.locale);
  return <FoundersPageContent locale={params.locale} />;
}
