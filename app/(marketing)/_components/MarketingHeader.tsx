"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";

export default function MarketingHeader() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  const nav = [
    { href: "/#solution", label: t("solution") },
    { href: "/#modules", label: t("modules") },
    { href: "/pricing", label: t("pricing") },
    { href: "/demo", label: t("demo") },
    { href: "/trial", label: t("trial") },
  ];

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-8 lg:px-10">
      <div
        className="mx-auto flex w-full max-w-[1480px] items-center justify-between rounded-[20px] px-4 py-3 backdrop-blur sm:px-5 md:px-7"
        style={{
          background: "var(--header-bg)",
          border: "1px solid var(--header-border)",
          boxShadow: "var(--header-shadow)",
        }}
      >
        {/* Logo — escala en móvil */}
        <Link href="/" className="flex shrink-0 items-center" onClick={() => setOpen(false)}>
          <svg
            viewBox="0 0 500 58"
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-auto sm:h-[44px]"
          >
            <rect x="0" y="0" width="7" height="47" fill="#0C1F44" rx="3"/>
            <rect x="0" y="40" width="47" height="7" fill="#0C1F44" rx="3"/>
            <line x1="15" y1="23" x2="26" y2="38" stroke="#185FA5" strokeWidth="7" strokeLinecap="round"/>
            <line x1="26" y1="38" x2="43" y2="10" stroke="#185FA5" strokeWidth="7" strokeLinecap="round"/>
            <line x1="63" y1="6" x2="63" y2="52" stroke="#D3D1C7" strokeWidth="0.8"/>
            <text x="75" y="36" fontFamily="Georgia, 'Times New Roman', serif" fontSize="28" fontWeight="700">
              <tspan fill="#0C1F44">Service</tspan><tspan fill="#185FA5">Control</tspan>
            </text>
            <text x="76" y="51" fontFamily="Georgia, 'Times New Roman', serif" fontSize="9.5" fontWeight="400" fill="#8A9BAD" letterSpacing="4">HOTEL QUALITY PLATFORM</text>
          </svg>
        </Link>

        {/* Nav desktop */}
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

        {/* Acciones desktop */}
        <div className="hidden items-center gap-2 lg:flex sm:gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="rounded-[6px] border border-[#0C1F44] bg-transparent px-4 py-2 text-sm font-medium text-[#0C1F44] transition hover:bg-[#0C1F44] hover:text-white sm:px-5"
          >
            {t("login")}
          </Link>
          <Link
            href="/trial"
            className="rounded-[6px] border border-[#185FA5] bg-[#185FA5] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#378ADD] sm:px-5"
          >
            {t("trial")}
          </Link>
        </div>

        {/* Acciones móvil */}
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/80 text-[#0C1F44] transition hover:bg-[#0C1F44]/5"
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <line x1="2" y1="2" x2="16" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="16" y1="2" x2="2" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <line x1="2" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="2" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {open && (
        <div
          className="mx-auto mt-2 w-full max-w-[1480px] overflow-hidden rounded-[20px] px-5 py-5 lg:hidden"
          style={{
            background: "var(--header-bg)",
            border: "1px solid var(--header-border)",
            boxShadow: "var(--header-shadow)",
            backdropFilter: "blur(12px)",
          }}
        >
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--text-secondary)] transition hover:bg-[#0C1F44]/[0.04] hover:text-[var(--text)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-black/[0.06] pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-[6px] border border-[#0C1F44] bg-transparent px-5 py-3 text-center text-sm font-medium text-[#0C1F44] transition hover:bg-[#0C1F44] hover:text-white"
            >
              {t("login")}
            </Link>
            <Link
              href="/trial"
              onClick={() => setOpen(false)}
              className="rounded-[6px] border border-[#185FA5] bg-[#185FA5] px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-[#378ADD]"
            >
              {t("trial")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}