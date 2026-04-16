import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";

export default function MarketingHeader() {
  const t = useTranslations("nav");

  const nav = [
    { href: "/#solution", label: t("solution") },
    { href: "/#modules", label: t("modules") },
    { href: "/pricing", label: t("pricing") },
    { href: "/demo", label: t("demo") },
  ];

  return (
    <header className="sticky top-0 z-50 px-5 pt-4 sm:px-8 lg:px-10">
      <div
        className="mx-auto flex w-full max-w-[1480px] items-center justify-between rounded-[20px] px-5 py-3 backdrop-blur md:px-7"
        style={{
          background: "var(--header-bg)",
          border: "1px solid var(--header-border)",
          boxShadow: "var(--header-shadow)",
        }}
      >
        <Link href="/" className="flex items-center">
          <svg width="220" height="52" viewBox="0 0 340 52" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="6" height="44" fill="#0C1F44" rx="3"/>
            <rect x="0" y="38" width="44" height="6" fill="#0C1F44" rx="3"/>
            <line x1="14" y1="22" x2="24" y2="36" stroke="#185FA5" strokeWidth="6" strokeLinecap="round"/>
            <line x1="24" y1="36" x2="40" y2="8" stroke="#185FA5" strokeWidth="6" strokeLinecap="round"/>
            <line x1="56" y1="6" x2="56" y2="46" stroke="#D3D1C7" strokeWidth="0.8"/>
            <text x="66" y="32" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="600" fill="#0C1F44">Service</text>
            <text x="156" y="32" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="600" fill="#185FA5">Control</text>
            <text x="66" y="46" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="400" fill="#888780" letterSpacing="2.5">HOTEL QUALITY PLATFORM</text>
          </svg>
        </Link>

        <nav className="hidden items-center gap-3 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-[14px] font-medium text-[var(--text-secondary)] transition hover:bg-[#0C1F44]/[0.04] hover:text-[var(--text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="rounded-[6px] border border-[#0C1F44] bg-transparent px-4 py-2 text-sm font-medium text-[#0C1F44] transition hover:bg-[#0C1F44] hover:text-white sm:px-5"
          >
            {t("login")}
          </Link>
          <Link
            href="/demo"
            className="rounded-[6px] border border-[#185FA5] bg-[#185FA5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#378ADD] sm:px-5"
          >
            {t("requestDemo")}
          </Link>
        </div>
      </div>
    </header>
  );
}
