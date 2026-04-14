import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";

function PricingPageContent() {
  const t = useTranslations("pricingPage");
  const highlights = t.raw("highlights") as string[];
  const evaluationItems = t.raw("evaluationItems") as string[];

  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section
            className="rounded-[28px] p-8 lg:p-10"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-black/8 pb-8">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  {t("planLabel")}
                </div>
                <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.4rem)] font-extrabold tracking-[-0.05em] text-[var(--text)]">
                  {t("planTitle")}
                </h1>
              </div>
              <div
                className="rounded-[18px] px-6 py-5 text-right"
                style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
              >
                <div className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  {t("modelLabel")}
                </div>
                <div className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--text)]">
                  {t("modelValue")}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] px-5 py-5 text-lg leading-8 text-[var(--text-secondary)]"
                  style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                >
                  {item}
                </div>
              ))}
              <div
                className="rounded-[18px] px-5 py-5 text-lg leading-8 text-white"
                style={{
                  background: "rgba(15,23,42,0.96)",
                  border: "1px solid var(--dark-border-subtle)",
                }}
              >
                {t("licenseNote")}
              </div>
            </div>
          </section>

          <aside
            className="rounded-[28px] p-8 text-white lg:p-10"
            style={{
              background: "rgba(15,23,42,0.96)",
              border: "1px solid var(--dark-border-subtle)",
              boxShadow: "var(--dark-shadow)",
            }}
          >
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/60">
              {t("evaluationLabel")}
            </div>
            <div className="mt-6 space-y-4">
              {evaluationItems.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] px-5 py-4 text-base text-[var(--dark-text-muted)]"
                  style={{ background: "var(--dark-card-bg)", border: "1px solid var(--dark-border-subtle)" }}
                >
                  {item}
                </div>
              ))}
            </div>

            <p className="mt-8 text-lg leading-8 text-[var(--dark-text-muted)]">
              {t("evaluationNote")}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/demo"
                className="rounded-xl border border-white/12 bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-white/90"
              >
                {t("ctaPrimary")}
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/14 px-6 py-3 text-sm font-black text-white transition hover:bg-white/8"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function PricingPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <PricingPageContent />;
}
