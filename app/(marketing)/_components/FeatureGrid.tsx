import SectionIntro from "./SectionIntro";
import { modules } from "./marketingContent";

export default function FeatureGrid() {
  return (
    <section id="modulos" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px]">
        <SectionIntro
          eyebrow="Capacidades"
          title="Modulos conectados para que la calidad no quede aislada del resto de la operacion."
          description="Cada bloque esta pensado para cerrar el ciclo completo: detectar, corregir, verificar y consolidar aprendizaje dentro del equipo."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          {modules.map((module, index) => {
            const span =
              index === 0
                ? "lg:col-span-5"
                : index === 1
                  ? "lg:col-span-3"
                  : index === 2
                    ? "lg:col-span-4"
                    : index === 3
                      ? "lg:col-span-4"
                      : "lg:col-span-8";

            return (
              <div
                key={module.title}
                className={`rounded-[30px] border border-black/8 bg-white/80 p-7 shadow-[0_16px_45px_rgba(15,23,42,0.06)] ${span}`}
              >
                <div className="text-sm font-extrabold uppercase tracking-[0.26em] text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-5 text-[1.9rem] font-bold tracking-tight text-slate-950">
                  {module.title}
                </h3>
                <p className="mt-4 max-w-[34rem] text-lg leading-8 text-slate-600">
                  {module.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
