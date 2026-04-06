import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="px-5 pb-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 border-t border-black/10 pt-8 text-sm text-[var(--text-secondary)] md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-base font-extrabold uppercase tracking-[0.22em] text-[var(--text)]">
            ServiceControl
          </div>
          <div className="mt-2 max-w-[42rem] leading-6">
            Plataforma para control operativo, calidad, reauditorias y seguimiento del equipo en hoteles.
          </div>
        </div>
        <div className="flex flex-wrap gap-5 font-semibold">
          <Link href="/pricing" className="transition hover:text-[var(--text)]">
            Pricing
          </Link>
          <Link href="/demo" className="transition hover:text-[var(--text)]">
            Demo
          </Link>
          <Link href="/login" className="transition hover:text-[var(--text)]">
            Acceder
          </Link>
          <span className="text-black/20">|</span>
          <Link href="/privacidad" className="font-normal transition hover:text-[var(--text)]">
            Privacidad
          </Link>
          <Link href="/aviso-legal" className="font-normal transition hover:text-[var(--text)]">
            Aviso legal
          </Link>
        </div>
      </div>
    </footer>
  );
}
