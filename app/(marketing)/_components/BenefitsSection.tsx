import { useTranslations } from "next-intl";
import SectionIntro from "./SectionIntro";

export default function BenefitsSection() {
  const t = useTranslations("benefits");
  const items = t.raw("items") as string[];

  return (
    <section id="beneficios" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((benefit) => (
            <div
              key={benefit}
              className="rounded-[18px] p-7"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-sm font-extrabold text-white">
                +
              </div>
              <p className="mt-5 text-xl leading-8 text-[var(--text-secondary)]">{benefit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
