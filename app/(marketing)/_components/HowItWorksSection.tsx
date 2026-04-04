import SectionIntro from "./SectionIntro";
import { steps } from "./marketingContent";

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow="Como funciona"
          title="Un flujo cerrado desde el hallazgo hasta la verificacion."
          description="No se trata de registrar problemas. Se trata de asegurarse de que se resuelven."
        />

        {/* Flow steps */}
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className="relative rounded-[18px] p-8"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Connector line between steps */}
              {index < steps.length - 1 && (
                <div
                  className="absolute -right-3 top-1/2 z-10 hidden h-px w-6 lg:block"
                  style={{ background: "var(--border)" }}
                />
              )}
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold text-white"
                style={{ background: "var(--text)" }}
              >
                {step.step}
              </div>
              <h3 className="mt-5 text-2xl font-bold tracking-tight text-[var(--text)]">
                {step.title}
              </h3>
              <p className="mt-4 text-lg leading-8 text-[var(--text-secondary)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Diferenciacion */}
        <div
          className="mt-8 rounded-[22px] px-8 py-8 lg:px-10"
          style={{
            background: "rgba(15,23,42,0.96)",
            border: "1px solid var(--dark-border-subtle)",
            boxShadow: "var(--dark-shadow)",
          }}
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/50">
                Otros sistemas
              </div>
              <p className="mt-4 text-2xl font-bold text-white/60">
                Registran lo que pasa.
              </p>
            </div>

            <div
              className="hidden h-16 w-px lg:block"
              style={{ background: "rgba(255,255,255,0.12)" }}
            />

            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/50">
                ServiceControl
              </div>
              <p className="mt-4 text-2xl font-bold text-white">
                Se asegura de que se corrija.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
