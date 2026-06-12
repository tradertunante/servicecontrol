import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function MarketingFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="bg-[#0C1F44] px-5 pb-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 border-t border-white/10 pt-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
        <div>
          <svg width="260" height="58" viewBox="0 0 500 58" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="7" height="47" fill="#FFFFFF" rx="3"/>
            <rect x="0" y="40" width="47" height="7" fill="#FFFFFF" rx="3"/>
            <line x1="15" y1="23" x2="26" y2="38" stroke="#378ADD" strokeWidth="7" strokeLinecap="round"/>
            <line x1="26" y1="38" x2="43" y2="10" stroke="#378ADD" strokeWidth="7" strokeLinecap="round"/>
            <line x1="63" y1="6" x2="63" y2="52" stroke="#444441" strokeWidth="0.8"/>
            <text x="75" y="36" fontFamily="Georgia, 'Times New Roman', serif" fontSize="28" fontWeight="700">
              <tspan fill="#FFFFFF">Service</tspan><tspan fill="#378ADD">Control</tspan>
            </text>
            <text x="76" y="51" fontFamily="Georgia, 'Times New Roman', serif" fontSize="9.5" fontWeight="400" fill="#5F5E5A" letterSpacing="4">HOTEL QUALITY PLATFORM</text>
          </svg>
          <div className="mt-2 max-w-[42rem] leading-6 text-white/60">
            {t("tagline")}
          </div>
        </div>
        <div className="flex flex-wrap gap-5 font-medium text-white/60">
          <Link href="/pricing" className="transition hover:text-white">
            {tNav("pricing")}
          </Link>
          <Link href="/demo" className="transition hover:text-white">
            {tNav("demo")}
          </Link>
          <Link href="/trial" className="transition hover:text-white">
            {tNav("trial")}
          </Link>
          <Link href="/login" className="transition hover:text-white">
            {tNav("login")}
          </Link>
          <a href="/help" className="transition hover:text-white">
            Centro de ayuda
          </a>
          <a href="/privacy" className="transition hover:text-white">
            {t("privacy")}
          </a>
          <a href="/cookies" className="transition hover:text-white">
            {t("cookies")}
          </a>
        </div>
      </div>
    </footer>
  );
}
