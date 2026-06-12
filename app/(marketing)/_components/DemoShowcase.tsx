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
                className="rounded-[6px] bg-[#185FA5] px-7 py-4 text-base font-medium text-white transition hover:bg-[#378ADD]"
              >
                {t("ctaPrimary")}
              </Link>
              <Link
                href="/pricing"
                className="rounded-[6px] border border-[#185FA5] bg-transparent px-7 py-4 text-base font-medium text-[#185FA5] transition hover:bg-[#185FA5]/5"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>

          {/* En móvil se muestra recortado con un degradado; completo a partir de lg */}
          <div className="max-h-[480px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)] lg:max-h-none lg:[mask-image:none]">
            <ProductOperationsMock />
          </div>
        </div>
      </div>
    </section>
  );
}
