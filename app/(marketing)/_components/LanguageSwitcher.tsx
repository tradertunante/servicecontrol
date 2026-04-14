"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = locale === "en" ? "es" : "en";
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm font-black text-black transition hover:bg-black hover:text-white disabled:opacity-50"
      aria-label="Switch language"
    >
      {locale === "en" ? "ES" : "EN"}
    </button>
  );
}
