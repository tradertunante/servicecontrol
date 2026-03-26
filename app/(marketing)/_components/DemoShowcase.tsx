import Link from "next/link";
import SectionIntro from "./SectionIntro";

export default function DemoShowcase() {
  return (
    <section id="demo" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px] rounded-[36px] border border-black/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(255,255,255,0.64))] p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 lg:p-10">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="max-w-[680px]">
            <SectionIntro
              eyebrow="Prueba visual"
              title="Una vista de calidad diseñada para tomar decisiones rapidas."
              description="La demo muestra la operacion por area, el estado de hallazgos, reauditorias y formacion en una composicion clara, sobria y ejecutiva."
            />
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/demo"
                className="rounded-full bg-slate-950 px-7 py-4 text-base font-extrabold text-white transition hover:bg-slate-800"
              >
                Ver demo
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-black/10 bg-white/70 px-7 py-4 text-base font-bold text-slate-700 transition hover:border-black/20 hover:bg-white"
              >
                Ver planes
              </Link>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-slate-950/8 bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.3em] text-slate-400">
                    Dashboard operativo
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight">Estado del hotel por area</div>
                </div>
                <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-slate-200">
                  Actualizado
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Recepcion", score: "88", tag: "1 alerta abierta" },
                  { label: "Housekeeping", score: "84", tag: "3 acciones en curso" },
                  { label: "Alimentos y bebidas", score: "90", tag: "2 reauditorias" },
                  { label: "Mantenimiento", score: "95", tag: "Operacion estable" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
                    <div className="text-sm text-slate-400">{item.label}</div>
                    <div className="mt-3 text-4xl font-extrabold tracking-tight">{item.score}%</div>
                    <div className="mt-3 text-sm text-slate-300">{item.tag}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[30px] border border-black/8 bg-white p-6">
                <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-slate-400">
                  Seguimiento
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    "Checklist de habitaciones VIP reprogramado",
                    "Formacion de apertura de turno completada",
                    "Reauditoria de buffet asignada para manana",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[30px] border border-black/8 bg-[#f2ebe1] p-6">
                <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#9f7a49]">
                  Calidad medible
                </div>
                <div className="mt-4 text-[2.5rem] font-extrabold tracking-tight text-slate-950">4.7x</div>
                <p className="mt-2 text-base leading-7 text-slate-700">
                  mas rapidez para identificar un hallazgo recurrente frente a seguimiento manual.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
