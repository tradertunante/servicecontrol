import Link from "next/link";
import { ProductDashboardMock } from "./MarketingShowcase";

export default function HeroSection() {
  return (
    <section className="px-5 pb-20 pt-8 sm:px-8 lg:px-10 lg:pb-24 lg:pt-10">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
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

          <h1 className="mt-7 text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[0.94] tracking-[-0.05em] text-[var(--text)]">
            La calidad no falla por falta de estandares. Falla por falta de control.
          </h1>

          <p className="mt-7 max-w-[680px] text-[clamp(1.125rem,2vw,1.35rem)] leading-8 text-[var(--text-secondary)]">
            Tu equipo ejecuta. El sistema hace el seguimiento. Direccion tiene la foto real.
            Sin Excel, sin mensajes dispersos ni rastros perdidos.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/demo"
              className="rounded-xl border border-black/15 bg-black px-7 py-4 text-base font-black text-white transition hover:bg-[#111827]"
            >
              Solicitar demo guiada
            </Link>
            <Link
              href="/#como-funciona"
              className="rounded-xl border border-black/15 bg-white px-7 py-4 text-base font-black text-black transition hover:bg-black hover:text-white"
            >
              Ver como funciona
            </Link>
          </div>

          <div className="mt-10 grid gap-4 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
            {[
              {
                eyebrow: "Detecta",
                text: "Score por area, alertas activas y focos rojos visibles antes de que escalen.",
              },
              {
                eyebrow: "Corrige",
                text: "Cada hallazgo genera una accion con responsable, prioridad y seguimiento.",
              },
              {
                eyebrow: "Verifica",
                text: "Reauditorias que confirman que la correccion se sostuvo en el tiempo.",
              },
            ].map((item) => (
              <div
                key={item.eyebrow}
                className="rounded-[18px] p-5"
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  {item.eyebrow}
                </div>
                <p className="mt-3 text-base leading-7">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <ProductDashboardMock />
        </div>
      </div>
    </section>
  );
}
