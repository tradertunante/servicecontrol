import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function MarketingFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="bg-[#0C1F44] px-5 pb-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 border-t border-white/10 pt-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
        <div>
          <svg width="220" height="52" viewBox="0 0 340 52" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="6" height="44" fill="#FFFFFF" rx="3"/>
            <rect x="0" y="38" width="44" height="6" fill="#FFFFFF" rx="3"/>
            <line x1="14" y1="22" x2="24" y2="36" stroke="#378ADD" strokeWidth="6" strokeLinecap="round"/>
            <line x1="24" y1="36" x2="40" y2="8" stroke="#378ADD" strokeWidth="6" strokeLinecap="round"/>
            <line x1="56" y1="6" x2="56" y2="46" stroke="#444441" strokeWidth="0.8"/>
            <text x="66" y="32" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="600" fill="#FFFFFF">Service</text>
            <text x="156" y="32" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="600" fill="#378ADD">Control</text>
            <text x="66" y="46" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="400" fill="#5F5E5A" letterSpacing="2.5">HOTEL QUALITY PLATFORM</text>
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
          <Link href="/login" className="transition hover:text-white">
            {tNav("login")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
