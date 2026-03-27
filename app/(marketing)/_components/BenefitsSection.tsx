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
              className="rounded-[18px] p-7"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-sm font-extrabold text-white">
                +
              </div>
              <p className="mt-5 text-xl leading-8 text-[var(--text-secondary)]">{benefit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
