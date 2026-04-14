import { useTranslations } from "next-intl";
import SectionIntro from "./SectionIntro";

export default function SolutionSection() {
  const t = useTranslations("solution");
  const features = t.raw("features") as string[];

  const pillars = [
    {
      eyebrow: t("pillar1Eyebrow"),
      title: t("pillar1Title"),
      description: t("pillar1Description"),
    },
    {
      eyebrow: t("pillar2Eyebrow"),
      title: t("pillar2Title"),
      description: t("pillar2Description"),
    },
  ];

  return (
    <section id="solucion" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div
        className="mx-auto w-full max-w-[1480px] rounded-[28px] px-6 py-10 text-white sm:px-8 lg:px-10 lg:py-14"
        style={{
          background: "rgba(15,23,42,0.96)",
          border: "1px solid var(--dark-border-subtle)",
          boxShadow: "var(--dark-shadow)",
        }}
      >
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          theme="dark"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-[18px] p-7"
              style={{
                background: "var(--dark-card-bg)",
                border: "1px solid var(--dark-border-subtle)",
              }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/60">
                {pillar.eyebrow}
              </div>
              <h3 className="mt-4 text-3xl font-bold tracking-tight text-white">{pillar.title}</h3>
              <p className="mt-4 text-lg leading-8 text-[var(--dark-text-muted)]">{pillar.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 border-t border-white/10 pt-8 text-base text-[var(--dark-text-muted)] sm:grid-cols-2 xl:grid-cols-4">
          {features.map((item) => (
            <div
              key={item}
              className="rounded-[16px] px-5 py-4"
              style={{
                background: "var(--dark-card-bg-subtle)",
                border: "1px solid var(--dark-border-subtle)",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
