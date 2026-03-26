import Link from "next/link";
import SectionIntro from "../_components/SectionIntro";

export default function DemoPage() {
  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow="Demo"
          title="Una demostracion enfocada en control operativo, no en una lista de features."
          description="La demo de ServiceControl enseña como se captura una auditoria, como se convierte en seguimiento accionable y como direccion gana visibilidad real sobre la operacion."
        />

        <div className="mt-12 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <section className="rounded-[34px] border border-black/8 bg-white/82 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-10">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[28px] border border-black/8 bg-slate-950 p-6 text-white">
                <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#d9c19c]">
                  Recorrido
                </div>
                <div className="mt-4 text-2xl font-bold tracking-tight">
                  De la auditoria al cierre de la desviacion
                </div>
                <div className="mt-6 space-y-4 text-base leading-7 text-slate-300">
                  <p>1. Configuracion de estandares y checklists por area.</p>
                  <p>2. Ejecucion movil con evidencia y scoring inmediato.</p>
                  <p>3. Accion correctiva, reauditoria y formacion conectadas.</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-black/8 bg-[#f2ebe1] p-6">
                <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#9f7a49]">
                  Enfoque
                </div>
                <div className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                  Operaciones, calidad y management en la misma conversacion
                </div>
                <p className="mt-4 text-base leading-7 text-slate-700">
                  La demo se adapta al tipo de hotel, areas criticas y flujo de seguimiento que hoy utilizas.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[30px] border border-black/8 bg-slate-50 p-6">
              <div className="text-sm font-extrabold uppercase tracking-[0.26em] text-slate-400">
                Lo que vas a ver
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  "Dashboard por area con score, alertas y backlog operativo",
                  "Ejecucion de auditorias y evidencias desde movil",
                  "Seguimiento de acciones correctivas y reauditorias",
                  "Registro de formacion vinculado a desviaciones reales",
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-black/8 bg-white px-4 py-4 text-base leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-[34px] border border-black/8 bg-slate-950 p-8 text-white shadow-[0_22px_70px_rgba(15,23,42,0.16)] lg:p-10">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#d9c19c]">
              Solicita una demo
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
              Muestra guiada para direccion, operaciones o calidad.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              De momento dejamos esta ruta preparada como punto comercial. Si despues decides conectar un formulario o calendario, la estructura ya queda separada del producto.
            </p>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
              <div className="text-sm font-bold text-slate-300">CTA sugerido</div>
              <div className="mt-3 text-xl font-bold">Solicitar demo comercial</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Puedes reemplazar este bloque por formulario, email o calendar booking cuando lo definas.
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/pricing"
                className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-slate-100"
              >
                Ver pricing
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
