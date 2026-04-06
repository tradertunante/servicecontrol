import Link from "next/link";
import { ProductOperationsMock } from "../_components/MarketingShowcase";
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
          <section
            className="rounded-[28px] p-8 lg:p-10"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div
                className="rounded-[20px] p-6 text-white"
                style={{
                  background: "rgba(15,23,42,0.96)",
                  border: "1px solid var(--dark-border-subtle)",
                }}
              >
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/60">
                  Recorrido
                </div>
                <div className="mt-4 text-2xl font-bold tracking-tight">
                  De la auditoria al cierre de la desviacion
                </div>
                <div className="mt-6 space-y-4 text-base leading-7 text-[var(--dark-text-muted)]">
                  <p>1. Configuracion de estandares y checklists por area.</p>
                  <p>2. Ejecucion movil con evidencia y scoring inmediato.</p>
                  <p>3. Accion correctiva, reauditoria y formacion conectadas.</p>
                </div>
              </div>

              <div
                className="rounded-[20px] p-6"
                style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
              >
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Enfoque
                </div>
                <div className="mt-4 text-2xl font-bold tracking-tight text-[var(--text)]">
                  Operaciones, calidad y management en la misma conversacion
                </div>
                <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
                  La demo se adapta al tipo de hotel, areas criticas y flujo de seguimiento que hoy utilizas.
                </p>
              </div>
            </div>

            <div
              className="mt-6 rounded-[20px] p-6"
              style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Lo que vas a ver
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  "Dashboard por area con score, alertas y backlog operativo",
                  "Ejecucion de auditorias y evidencias desde movil",
                  "Seguimiento de acciones correctivas y reauditorias",
                  "Registro de formacion vinculado a desviaciones reales",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[16px] bg-white px-4 py-4 text-base leading-7 text-[var(--text-secondary)]"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <ProductOperationsMock />
            </div>
          </section>

          <aside
            className="rounded-[28px] p-8 text-white lg:p-10"
            style={{
              background: "rgba(15,23,42,0.96)",
              border: "1px solid var(--dark-border-subtle)",
              boxShadow: "var(--dark-shadow)",
            }}
          >
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/60">
              Solicita una demo
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
              Muestra guiada para direccion, operaciones o calidad.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[var(--dark-text-muted)]">
              25 minutos para ver como ServiceControl se adapta a la operacion real de tu hotel:
              areas criticas, flujo de seguimiento y visibilidad ejecutiva.
            </p>

            <div
              className="mt-8 space-y-3 rounded-[20px] p-5"
              style={{ background: "var(--dark-card-bg)", border: "1px solid var(--dark-border-subtle)" }}
            >
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/50">
                En la demo veras
              </div>
              {[
                "Dashboard por area con score y alertas activas",
                "Ejecucion de auditoria desde movil con evidencia",
                "Accion correctiva, reauditoria y formacion conectadas",
                "Visibilidad ejecutiva sin depender de reportes",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-6 text-white/70">
                  <span className="mt-0.5 text-white/30">—</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <a
              href="mailto:demo@servicecontrol.io"
              className="mt-8 block rounded-xl border border-white/12 bg-white px-6 py-4 text-center text-base font-black text-black transition hover:bg-white/90"
            >
              Solicitar demo guiada
            </a>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/pricing"
                className="rounded-xl border border-white/14 px-6 py-3 text-sm font-black text-white transition hover:bg-white/8"
              >
                Ver pricing
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/14 px-6 py-3 text-sm font-black text-white transition hover:bg-white/8"
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
