"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import posthog from "posthog-js";

export default function FinalCTA() {
  const t = useTranslations("finalCta");

  return (
    <section className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28">
      <div
        className="mx-auto w-full max-w-[1480px] rounded-[28px] px-6 py-12 text-white sm:px-8 lg:px-12 lg:py-14"
        style={{
          background: "#0C1F44",
          border: "1px solid var(--dark-border-subtle)",
          boxShadow: "var(--dark-shadow)",
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-[860px]">
            <div className="text-[11px] font-normal uppercase tracking-[2.5px] text-white/60">
              {t("eyebrow")}
            </div>
            <h2 className="mt-4">
              {t("title")}
            </h2>
            <p className="mt-5 text-[#B5D4F4]">
              {t("description")}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              href="/demo"
              onClick={() => posthog.capture('cta_clicked', { cta_location: 'final_cta', cta_destination: 'demo' }, { send_instantly: true })}
              className="rounded-[6px] border border-[#185FA5] bg-[#185FA5] px-7 py-4 text-base font-medium text-white transition hover:bg-[#378ADD]"
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href="/trial"
              onClick={() => posthog.capture('cta_clicked', { cta_location: 'final_cta', cta_destination: 'trial' }, { send_instantly: true })}
              className="rounded-[6px] border border-white/40 bg-white/10 px-7 py-4 text-base font-medium text-white transition hover:bg-white/20"
            >
              {t("ctaTrial")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
