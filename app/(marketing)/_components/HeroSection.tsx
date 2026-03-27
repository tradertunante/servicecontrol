import Link from "next/link";
import { ProductDashboardMock } from "./MarketingShowcase";

export default function HeroSection() {
  return (
    <section className="px-5 pb-20 pt-8 sm:px-8 lg:px-10 lg:pb-24 lg:pt-10">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(560px,0.9fr)] lg:items-center">
        <div className="max-w-[820px]">
          <div
            className="inline-flex rounded-full px-4 py-2 text-sm font-black text-[var(--text-secondary)]"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            Plataforma SaaS para operacion y calidad hotelera
          </div>

          <h1 className="mt-7 max-w-[14ch] text-[clamp(3.6rem,9vw,6.8rem)] font-extrabold leading-[0.94] tracking-[-0.05em] text-[var(--text)]">
            Controla la calidad de tu hotel en tiempo real.
          </h1>

          <p className="mt-7 max-w-[720px] text-[clamp(1.125rem,2vw,1.45rem)] leading-8 text-[var(--text-secondary)]">
            Detecta fallos, ejecuta auditorias y mejora la operacion sin caos ni Excel.
            ServiceControl centraliza auditorias, reauditorias, formacion y seguimiento
            del equipo en una sola plataforma.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/demo"
              className="rounded-xl border border-black/15 bg-black px-7 py-4 text-base font-black text-white transition hover:bg-[#111827]"
            >
              Solicitar demo
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-black/15 bg-white px-7 py-4 text-base font-black text-black transition hover:bg-black hover:text-white"
            >
              Acceder a la app
            </Link>
          </div>

          <div className="mt-10 grid gap-4 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Visibilidad real
              </div>
              <p className="mt-3 text-base leading-7">
                Score por area, backlog correctivo y focos rojos visibles para operaciones.
              </p>
            </div>
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Ejecucion diaria
              </div>
              <p className="mt-3 text-base leading-7">
                Auditorias desde movil con evidencia y seguimiento sin depender de memoria.
              </p>
            </div>
            <div
              className="rounded-[18px] p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Sistema unico
              </div>
              <p className="mt-3 text-base leading-7">
                Calidad, reauditorias y formacion conectadas en un solo flujo.
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <ProductDashboardMock />
        </div>
      </div>
    </section>
  );
}
