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
              className="rounded-[30px] border border-black/8 bg-white/75 p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <div className="text-sm font-extrabold uppercase tracking-[0.3em] text-[#9f7a49]">
                {item.step}
              </div>
              <h3 className="mt-5 text-[1.75rem] font-bold tracking-tight text-slate-950">
                {item.title}
              </h3>
              <p className="mt-4 text-lg leading-8 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
