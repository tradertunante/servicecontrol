"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionIntro from "./SectionIntro";
import posthog from "posthog-js";

export default function ScenariosSection() {
  const t = useTranslations("scenarios");
  const items = t.raw("items") as { role: string; title: string; body: string }[];

  return (
    <section id="escenarios" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          align="center"
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.role}
              className="rounded-[18px] p-7"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="text-[11px] font-normal uppercase tracking-[2.5px] text-[#888780]">
                {item.role}
              </div>
              <h3 className="mt-4 text-[var(--text)]">{item.title}</h3>
              <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">{item.body}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-[18px] p-7"
          style={{
            background: "var(--card-bg)",
            border: "2px solid #185FA5",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="max-w-[820px]">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "#EBF3FC", color: "#185FA5", border: "1px solid #C3DCEE" }}
            >
              {t("foundersBadge")}
            </span>
            <h3 className="mt-4 text-[var(--text)]">{t("foundersTitle")}</h3>
            <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">{t("foundersBody")}</p>
          </div>
          <Link
            href="/demo"
            onClick={() => posthog.capture('cta_clicked', { cta_location: 'founders_banner', cta_destination: 'demo' }, { send_instantly: true })}
            className="rounded-[6px] bg-[#185FA5] px-7 py-4 text-center text-base font-medium text-white transition hover:bg-[#378ADD]"
          >
            {t("foundersCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}