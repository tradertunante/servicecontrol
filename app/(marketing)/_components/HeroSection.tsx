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
            className="inline-flex rounded-full px-4 py-2 text-sm font-black text-[var(--text-secondary)]"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {t("badge")}
          </div>

          <h1
            className="mt-7 font-extrabold leading-[1.15] tracking-[-0.04em] text-[#0a0a0a]"
            style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)" }}
          >
            {t("h1Part1")}
            <br />
            <span
              style={{
                background: "#0a0a0a",
                color: "#f8f7f4",
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
            <span style={{ color: "#9ca3af" }}>{t("h1Muted")}</span>
          </h1>

          <p className="mt-7 max-w-[560px] text-[clamp(1rem,1.8vw,1.2rem)] leading-7 text-[var(--text-secondary)]">
            {t("subtitle")}{" "}
            <strong className="text-[#0a0a0a]">{t("subtitleBold")}</strong>
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/demo"
              className="rounded-xl bg-[#0a0a0a] px-7 py-4 text-base font-black text-[#f8f7f4] transition hover:bg-[#1f1f1f]"
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-black/20 bg-transparent px-7 py-4 text-base font-black text-[#0a0a0a] transition hover:bg-black/5"
            >
              {t("ctaSecondary")}
            </Link>
          </div>

          <div className="mt-10 grid gap-4 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {t("card1Title")}
              </div>
              <p className="mt-3 text-base leading-7">{t("card1Body")}</p>
            </div>
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {t("card2Title")}
              </div>
              <p className="mt-3 text-base leading-7">{t("card2Body")}</p>
            </div>
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {t("card3Title")}
              </div>
              <p className="mt-3 text-base leading-7">{t("card3Body")}</p>
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
