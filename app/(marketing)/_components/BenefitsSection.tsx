import SectionIntro from "./SectionIntro";
import { benefits } from "./marketingContent";

export default function BenefitsSection() {
  return (
    <section id="beneficios" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionIntro
          eyebrow="Resultados"
          title="Menos caos operativo. Mas capacidad de reaccion y control."
          description="La plataforma esta pensada para que direccion, operaciones y calidad trabajen con la misma fotografia del hotel y puedan actuar antes de que una desviacion se normalice."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div
              key={benefit}
              className="rounded-[28px] border border-black/8 bg-[rgba(255,255,255,0.82)] p-7 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-extrabold text-white">
                +
              </div>
              <p className="mt-5 text-xl leading-8 text-slate-700">{benefit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
