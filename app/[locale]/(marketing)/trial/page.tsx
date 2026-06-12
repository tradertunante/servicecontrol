import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";
import TrialForm from "@/app/(marketing)/_components/TrialForm";
import { localeAlternates } from "@/lib/marketingSeo";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  return { alternates: localeAlternates(params.locale, "/trial") };
}

function TrialPageContent() {
  const t = useTranslations("trialPage");
  const bullets = t.raw("bullets") as string[];

  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_480px] lg:items-start">

          {/* Left: what they get */}
          <div className="space-y-6">
            <div
              className="rounded-[20px] p-8"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[2px] text-[#888780]">
                {t("whatLabel")}
              </div>
              <div className="mt-3 text-lg font-bold text-[var(--text)]">{t("whatTitle")}</div>
              <ul className="mt-5 space-y-3">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "#185FA5" }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-[20px] p-6"
              style={{ background: "rgba(15,23,42,0.96)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[2px] text-white/50">
                {t("noteLabel")}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/70">{t("noteBody")}</p>
            </div>
          </div>

          {/* Right: form */}
          <TrialForm />
        </div>
      </div>
    </main>
  );
}

export default async function TrialPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  setRequestLocale(params.locale);
  return <TrialPageContent />;
}