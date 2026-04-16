import { useTranslations } from "next-intl";
import SectionIntro from "./SectionIntro";

export default function ProblemSection() {
  const t = useTranslations("problem");
  const points = t.raw("points") as string[];

  return (
    <section id="problema" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {points.map((point, index) => (
            <div
              key={index}
              className="rounded-[18px] p-7"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]">
                0{index + 1}
              </div>
              <p className="mt-4 text-lg leading-8 text-[var(--text-secondary)]">{point}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
