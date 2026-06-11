import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";
import CalEmbed from "@/app/(marketing)/_components/CalEmbed";

function DemoPageContent({ locale }: { locale: string }) {
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

          </section>

          <aside
            className="overflow-hidden rounded-[28px]"
            style={{
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
              height: "100%",
            }}
          >
            <CalEmbed locale={locale} />
          </aside>
        </div>
      </div>
    </main>
  );
}

export default async function DemoPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  setRequestLocale(params.locale);
  return <DemoPageContent locale={params.locale} />;
}
