import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28">
      <div
        className="mx-auto w-full max-w-[1480px] rounded-[28px] px-6 py-12 text-white sm:px-8 lg:px-12 lg:py-14"
        style={{
          background: "rgba(15,23,42,0.96)",
          border: "1px solid var(--dark-border-subtle)",
          boxShadow: "var(--dark-shadow)",
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-[860px]">
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/60">
              Solicita una demo
            </div>
            <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
              Lleva control, seguimiento y visibilidad real a la operacion de tu hotel.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Te mostramos como adaptar ServiceControl a tus areas, estandares y flujo operativo sin mezclar la experiencia comercial con la app interna.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/demo"
              className="rounded-xl border border-white/12 bg-white px-7 py-4 text-base font-black text-black transition hover:bg-white/90"
            >
              Solicitar demo
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/14 px-7 py-4 text-base font-black text-white transition hover:bg-white/8"
            >
              Acceder
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
