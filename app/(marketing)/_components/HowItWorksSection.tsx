import SectionIntro from "./SectionIntro";
import { steps } from "./marketingContent";

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow="Como funciona"
          title="Tres pasos para pasar de revision puntual a control operativo continuo."
          description="La experiencia esta diseñada para hoteles que necesitan estandarizar ejecucion sin introducir mas complejidad al equipo."
          align="center"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((item) => (
            <div
              key={item.step}
              className="rounded-[18px] p-8"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="inline-flex rounded-full px-3 py-1 text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
                style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
              >
                {item.step}
              </div>
              <h3 className="mt-5 text-[1.75rem] font-bold tracking-tight text-[var(--text)]">
                {item.title}
              </h3>
              <p className="mt-4 text-lg leading-8 text-[var(--text-secondary)]">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
