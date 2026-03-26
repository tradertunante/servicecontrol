import SectionIntro from "./SectionIntro";
import { solutionPillars } from "./marketingContent";

export default function SolutionSection() {
  return (
    <section id="solucion" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px] rounded-[36px] border border-black/8 bg-slate-950 px-6 py-10 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-8 lg:px-10 lg:py-14">
        <SectionIntro
          eyebrow="La solucion"
          title="ServiceControl convierte la calidad del hotel en un sistema operativo."
          description="No se trata solo de auditar. Se trata de detectar, asignar, formar y verificar con una sola plataforma que da continuidad a cada desviacion."
          theme="dark"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {solutionPillars.map((pillar) => (
            <div key={pillar.title} className="rounded-[28px] border border-white/10 bg-white/[0.05] p-7">
              <div className="text-xs font-extrabold uppercase tracking-[0.26em] text-[#d9c19c]">
                {pillar.eyebrow}
              </div>
              <h3 className="mt-4 text-3xl font-bold tracking-tight text-white">{pillar.title}</h3>
              <p className="mt-4 text-lg leading-8 text-slate-300">{pillar.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 border-t border-white/10 pt-8 text-base text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          {[
            "Auditorias digitales con evidencia y score por area",
            "Reauditorias para confirmar que el problema se corrigio",
            "Acciones correctivas con responsables y seguimiento visible",
            "Formacion vinculada a desviaciones reales del equipo",
          ].map((item) => (
            <div key={item} className="rounded-[24px] border border-white/10 bg-black/10 px-5 py-4">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
