import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductDashboardMock } from "./MarketingShowcase";

export default function HeroSection() {
  const t = useTranslations("hero");

  return (
    <section className="px-5 pb-20 pt-8 sm:px-8 lg:px-10 lg:pb-24 lg:pt-10">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="max-w-[820px]">
          <div
            className="inline-flex rounded-full px-4 py-2 text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {t("badge")}
          </div>

          <h1
            className="mt-7 text-[#0C1F44]"
          >
            {t("h1Part1")}
            <br />
            <span
              style={{
                background: "#0C1F44",
                color: "#FFFFFF",
                borderRadius: "4px",
                padding: "0 10px",
                display: "inline",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }}
            >
              {t("h1Highlight")}
            </span>
            <br />
            <span style={{ color: "#888780" }}>{t("h1Muted")}</span>
          </h1>

          <p className="mt-7 max-w-[560px] text-[var(--text-secondary)]">
            {t("subtitle")}{" "}
            <strong className="text-[#0a0a0a]">{t("subtitleBold")}</strong>
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/demo"
              className="rounded-[6px] bg-[#185FA5] px-7 py-4 text-base font-medium text-white transition hover:bg-[#378ADD]"
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href="/login"
              className="rounded-[6px] border border-[#0C1F44] bg-transparent px-7 py-4 text-base font-medium text-[#0C1F44] transition hover:bg-[#0C1F44]/5"
            >
              {t("ctaSecondary")}
            </Link>
          </div>

          <div className="mt-10 grid gap-4 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]">
                {t("card1Title")}
              </div>
              <p className="mt-3">{t("card1Body")}</p>
            </div>
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]">
                {t("card2Title")}
              </div>
              <p className="mt-3">{t("card2Body")}</p>
            </div>
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]">
                {t("card3Title")}
              </div>
              <p className="mt-3">{t("card3Body")}</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <ProductDashboardMock />
        </div>
      </div>
    </section>
  );
}
