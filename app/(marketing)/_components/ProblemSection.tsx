import SectionIntro from "./SectionIntro";
import { problemPoints } from "./marketingContent";

export default function ProblemSection() {
  return (
    <section id="problema" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionIntro
          eyebrow="El problema"
          title="La calidad se rompe cuando depende de memoria, improvisacion o seguimiento manual."
          description="En muchos hoteles, la operacion se sostiene con hojas, capturas, mensajes y reportes tardios. El resultado no es solo desorden: es perdida de control."
        />

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
