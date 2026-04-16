import { useTranslations } from "next-intl";
import SectionIntro from "./SectionIntro";

type Step = { step: string; title: string; description: string };

export default function HowItWorksSection() {
  const t = useTranslations("howItWorks");
  const steps = t.raw("steps") as Step[];

  return (
    <section id="como-funciona" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          align="center"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((item) => (
            <div
              key={item.step}
              className="rounded-[18px] p-8"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="inline-flex rounded-full px-3 py-1 text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]"
                style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
              >
                {item.step}
              </div>
              <h3 className="mt-5 text-[var(--text)]">
                {item.title}
              </h3>
              <p className="mt-4 text-lg leading-8 text-[var(--text-secondary)]">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
