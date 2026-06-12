import { useTranslations } from "next-intl";
import SectionIntro from "./SectionIntro";

export default function TrustSection() {
  const t = useTranslations("trust");
  const items = t.raw("items") as { title: string; body: string }[];
  const facts = t.raw("facts") as string[];

  return (
    <section id="confianza" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div
        className="mx-auto w-full max-w-[1480px] rounded-[28px] px-6 py-10 text-white sm:px-8 lg:px-10 lg:py-14"
        style={{
          background: "#0C1F44",
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

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-[18px] p-7"
              style={{
                background: "var(--dark-card-bg)",
                border: "1px solid var(--dark-border-subtle)",
              }}
            >
              <h3 className="text-white">{item.title}</h3>
              <p className="mt-4 text-lg leading-8 text-[var(--dark-text-muted)]">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 border-t border-white/10 pt-8 text-base text-[var(--dark-text-muted)] sm:grid-cols-2 xl:grid-cols-4">
          {facts.map((fact) => (
            <div
              key={fact}
              className="rounded-[16px] px-5 py-4"
              style={{
                background: "var(--dark-card-bg-subtle)",
                border: "1px solid var(--dark-border-subtle)",
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}