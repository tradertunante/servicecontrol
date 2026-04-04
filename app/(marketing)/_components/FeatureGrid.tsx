import SectionIntro from "./SectionIntro";
import { modules } from "./marketingContent";

export default function FeatureGrid() {
  return (
    <section id="modulos" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto w-full max-w-[1480px]">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <SectionIntro
            eyebrow="Capacidades"
            title="Modulos conectados para cerrar el ciclo completo."
            description="Cada bloque esta disenado para que la calidad no quede aislada del resto de la operacion. Detectar, corregir, verificar y consolidar en un solo flujo."
          />

          {/* Diferenciacion inline */}
          <div
            className="rounded-[18px] px-6 py-6"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              Por que importa
            </div>
            <p className="mt-4 text-2xl font-bold leading-tight tracking-tight text-[var(--text)]">
              ServiceControl no es un software de auditorias.
              <span className="block text-[var(--text-secondary)]">
                Es un sistema de ejecucion operativa.
              </span>
            </p>
          </div>
        </div>

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
                className={`rounded-[18px] p-7 ${span}`}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-5 text-[1.9rem] font-bold tracking-tight text-[var(--text)]">
                  {module.title}
                </h3>
                <p className="mt-4 max-w-[34rem] text-lg leading-8 text-[var(--text-secondary)]">
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
