import { useTranslations } from "next-intl";
import SectionIntro from "./SectionIntro";

type Module = { title: string; description: string };

export default function FeatureGrid() {
  const t = useTranslations("featureGrid");
  const modules = t.raw("modules") as Module[];

  return (
    <section id="modulos" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          {modules.map((module, index) => {
            const span =
              index === 0
                ? "lg:col-span-5"
                : index === 1
                  ? "lg:col-span-3"
                  : index === 2
                    ? "lg:col-span-4"
                    : index === 3
                      ? "lg:col-span-4"
                      : "lg:col-span-8";

            return (
              <div
                key={module.title}
                className={`rounded-[18px] p-7 ${span}`}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-5 text-[var(--text)]">
                  {module.title}
                </h3>
                <p className="mt-4 max-w-[34rem] text-lg leading-8 text-[var(--text-secondary)]">
                  {module.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
