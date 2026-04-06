import SectionIntro from "./SectionIntro";
import { problemPoints } from "./marketingContent";

export default function ProblemSection() {
  return (
    <section id="problema" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <SectionIntro
            eyebrow="Por que falla la ejecucion operativa"
            title="La mayoria de los hoteles no tiene un problema de calidad. Tiene un problema de ejecucion."
            description="Cuando el control depende de reportes manuales, WhatsApp y memoria, ya vas tarde. El caos no es visible hasta que el huesped lo nota."
          />

          {/* Tension statement */}
          <div
            className="mt-8 rounded-[18px] px-6 py-6"
            style={{
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
            }}
          >
            <p className="text-lg font-bold leading-8" style={{ color: "var(--danger)" }}>
              Cuando el control depende de seguimiento manual,
              los fallos no desaparecen. Se normalizan.
              <span className="mt-2 block font-semibold opacity-80">
                Y cuando el huesped lo nota, ya es tarde.
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {problemPoints.map((point, index) => (
            <div
              key={point}
              className="rounded-[18px] p-7"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="text-sm font-extrabold tracking-[0.18em] text-[var(--text-secondary)]">
                0{index + 1}
              </div>
              <p className="mt-4 text-lg leading-8 text-[var(--text-secondary)]">{point}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
