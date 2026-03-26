import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="px-5 pb-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 border-t border-black/10 pt-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-base font-extrabold uppercase tracking-[0.22em] text-slate-900">
            ServiceControl
          </div>
          <div className="mt-2 max-w-[42rem] leading-6">
            Plataforma para control operativo, calidad, reauditorias y seguimiento del equipo en hoteles.
          </div>
        </div>
        <div className="flex flex-wrap gap-5 font-semibold">
          <Link href="/pricing" className="transition hover:text-slate-950">
            Pricing
          </Link>
          <Link href="/demo" className="transition hover:text-slate-950">
            Demo
          </Link>
          <Link href="/login" className="transition hover:text-slate-950">
            Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
