import Link from "next/link";
import { marketingNav } from "./marketingContent";

export default function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 px-5 pt-4 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between rounded-full border border-black/10 bg-white/80 px-5 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur md:px-7">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-extrabold text-white">
            SC
          </div>
          <div>
            <div className="text-[15px] font-extrabold tracking-[0.2em] text-slate-950 uppercase">
              ServiceControl
            </div>
            <div className="hidden text-sm text-slate-500 sm:block">
              Calidad y operacion hotelera
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-[15px] font-semibold text-slate-600 lg:flex">
          {marketingNav.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-slate-950">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-black/20 hover:bg-black/[0.03] sm:px-5"
          >
            Acceder
          </Link>
          <Link
            href="/demo"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.24)] transition hover:bg-slate-800 sm:px-5"
          >
            Solicitar demo
          </Link>
        </div>
      </div>
    </header>
  );
}
