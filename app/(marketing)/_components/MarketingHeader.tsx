import Link from "next/link";
import { marketingNav } from "./marketingContent";

export default function MarketingHeader() {
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
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-black text-sm font-extrabold text-white">
            SC
          </div>
          <div>
            <div className="text-[15px] font-extrabold tracking-[0.2em] uppercase text-[var(--text)]">
              ServiceControl
            </div>
            <div className="hidden text-sm text-[var(--text-secondary)] sm:block">
              Calidad y operacion hotelera
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-3 lg:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-[14px] font-black text-[var(--text-secondary)] transition hover:bg-black/[0.04] hover:text-[var(--text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-black hover:text-white sm:px-5"
          >
            Acceder
          </Link>
          <Link
            href="/demo"
            className="rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-[#111827] sm:px-5"
          >
            Solicitar demo
          </Link>
        </div>
      </div>
    </header>
  );
}
