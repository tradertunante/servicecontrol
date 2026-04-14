import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function MarketingFooter() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="px-5 pb-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 border-t border-black/10 pt-8 text-sm text-[var(--text-secondary)] md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-base font-extrabold uppercase tracking-[0.22em] text-[var(--text)]">
            ServiceControl
          </div>
          <div className="mt-2 max-w-[42rem] leading-6">
            {t("tagline")}
          </div>
        </div>
        <div className="flex flex-wrap gap-5 font-semibold">
          <Link href="/pricing" className="transition hover:text-[var(--text)]">
            {tNav("pricing")}
          </Link>
          <Link href="/demo" className="transition hover:text-[var(--text)]">
            {tNav("demo")}
          </Link>
          <Link href="/login" className="transition hover:text-[var(--text)]">
            {tNav("login")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
