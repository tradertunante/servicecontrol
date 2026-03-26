import Link from "next/link";
import SectionIntro from "../_components/SectionIntro";
import { pricingHighlights } from "../_components/marketingContent";

export default function PricingPage() {
  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow="Pricing"
          title="Planes pensados para hoteles que necesitan control operativo real."
          description="La contratacion se define segun numero de areas, complejidad operativa y alcance de implantacion. Priorizamos una propuesta clara y alineada con tu operacion."
        />

        <div className="mt-12 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[34px] border border-black/8 bg-white/82 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-10">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-black/8 pb-8">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#9f7a49]">
                  Plan Growth Hotel
                </div>
                <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.4rem)] font-extrabold tracking-[-0.05em] text-slate-950">
                  Implementacion guiada y licencia anual
                </h1>
              </div>
              <div className="rounded-[28px] border border-slate-950/8 bg-[#f2ebe1] px-6 py-5 text-right">
                <div className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">
                  Modelo comercial
                </div>
                <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
                  Presupuesto a medida
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {pricingHighlights.map((item) => (
                <div key={item} className="rounded-[26px] border border-black/8 bg-slate-50 px-5 py-5 text-lg leading-8 text-slate-700">
                  {item}
                </div>
              ))}
              <div className="rounded-[26px] border border-black/8 bg-slate-950 px-5 py-5 text-lg leading-8 text-white">
                Licencia para auditorias, reauditorias, acciones correctivas, formacion y dashboard ejecutivo.
              </div>
            </div>
          </section>

          <aside className="rounded-[34px] border border-black/8 bg-slate-950 p-8 text-white shadow-[0_22px_70px_rgba(15,23,42,0.16)] lg:p-10">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#d9c19c]">
              Lo que evaluamos
            </div>
            <div className="mt-6 space-y-4">
              {[
                "Numero de hoteles y areas operativas",
                "Volumen de auditorias y responsables involucrados",
                "Nivel de acompanamiento deseado en implantacion",
                "Necesidades de reporting para direccion y management",
              ].map((item) => (
                <div key={item} className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-4 text-base text-slate-200">
                  {item}
                </div>
              ))}
            </div>

            <p className="mt-8 text-lg leading-8 text-slate-300">
              Si quieres evaluar encaje, te mostramos la plataforma y preparamos una propuesta ajustada a tu operacion.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/demo"
                className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-slate-100"
              >
                Solicitar demo
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/14 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/8"
              >
                Acceder
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
