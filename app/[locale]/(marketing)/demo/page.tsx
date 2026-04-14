import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";
import { ProductOperationsMock } from "@/app/(marketing)/_components/MarketingShowcase";

function DemoPageContent() {
  const t = useTranslations("demoPage");
  const whatYouSee = t.raw("whatYouSee") as string[];

  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <section
            className="rounded-[28px] p-8 lg:p-10"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div
                className="rounded-[20px] p-6 text-white"
                style={{
                  background: "rgba(15,23,42,0.96)",
                  border: "1px solid var(--dark-border-subtle)",
                }}
              >
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/60">
                  {t("journeyLabel")}
                </div>
                <div className="mt-4 text-2xl font-bold tracking-tight">
                  {t("journeyTitle")}
                </div>
                <div className="mt-6 space-y-4 text-base leading-7 text-[var(--dark-text-muted)]">
                  <p>{t("journeyStep1")}</p>
                  <p>{t("journeyStep2")}</p>
                  <p>{t("journeyStep3")}</p>
                </div>
              </div>

              <div
                className="rounded-[20px] p-6"
                style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
              >
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  {t("focusLabel")}
                </div>
                <div className="mt-4 text-2xl font-bold tracking-tight text-[var(--text)]">
                  {t("focusTitle")}
                </div>
                <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
                  {t("focusDescription")}
                </p>
              </div>
            </div>

            <div
              className="mt-6 rounded-[20px] p-6"
              style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {t("whatYouSeeLabel")}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {whatYouSee.map((item) => (
                  <div
                    key={item}
                    className="rounded-[16px] bg-white px-4 py-4 text-base leading-7 text-[var(--text-secondary)]"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <ProductOperationsMock />
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
              {t("ctaLabel")}
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
              {t("ctaTitle")}
            </h2>
            <p className="mt-5 text-lg leading-8 text-[var(--dark-text-muted)]">
              {t("ctaDescription")}
            </p>

            <div
              className="mt-8 rounded-[20px] p-5"
              style={{ background: "var(--dark-card-bg)", border: "1px solid var(--dark-border-subtle)" }}
            >
              <div className="text-sm font-bold text-[var(--dark-text-muted)]">{t("ctaSuggestedLabel")}</div>
              <div className="mt-3 text-xl font-bold">{t("ctaSuggestedTitle")}</div>
              <div className="mt-2 text-sm leading-6 text-white/60">
                {t("ctaSuggestedNote")}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/pricing"
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

export default function DemoPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <DemoPageContent />;
}
