import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionIntro from "./SectionIntro";
import { ProductOperationsMock } from "./MarketingShowcase";

export default function DemoShowcase() {
  const t = useTranslations("demoShowcase");

  return (
    <section id="demo" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div
        className="mx-auto w-full max-w-[1480px] rounded-[28px] p-6 sm:p-8 lg:p-10"
        style={{
          background: "rgba(255,255,255,0.58)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="max-w-[680px]">
            <SectionIntro
              eyebrow={t("eyebrow")}
              title={t("title")}
              description={t("description")}
            />
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/demo"
                className="rounded-xl border border-black/15 bg-black px-7 py-4 text-base font-black text-white transition hover:bg-[#111827]"
              >
                {t("ctaPrimary")}
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-black/15 bg-white px-7 py-4 text-base font-black text-black transition hover:bg-black hover:text-white"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <ProductOperationsMock />
          </div>
        </div>
      </div>
    </section>
  );
}
