"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setAppLocale } from "@/app/actions/locale";

export default function AppLocaleSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = locale === "en" ? "es" : "en";
    startTransition(() => {
      void setAppLocale(next);
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="px-3 h-8 rounded-lg text-[13px] font-black text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors disabled:opacity-40"
      aria-label="Switch language"
    >
      {locale === "en" ? "ES" : "EN"}
    </button>
  );
}
