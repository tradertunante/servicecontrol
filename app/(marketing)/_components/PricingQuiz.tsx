"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Answers = {
  multihotel: boolean | null;
  formaciones: boolean | null;
  it: boolean | null;
  manto: boolean | null;
};

type Step = "q_multihotel" | "q_formaciones" | "q_it" | "q_manto" | "result";

// ─── Plan logic ───────────────────────────────────────────────────────────────

type PlanKey = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8";

type PlanDef = {
  id: string;
  name: string;
  modules: string[];
  highlight: boolean;
};

const PLANS: Record<PlanKey, PlanDef> = {
  P1: {
    id: "#P1",
    name: "Esencial",
    modules: ["Base"],
    highlight: false,
  },
  P2: {
    id: "#P2",
    name: "Operativo",
    modules: ["Base", "Formaciones"],
    highlight: false,
  },
  P3: {
    id: "#P3",
    name: "Técnico IT",
    modules: ["Base", "IT"],
    highlight: false,
  },
  P4: {
    id: "#P4",
    name: "Técnico Manto",
    modules: ["Base", "Mantenimiento"],
    highlight: false,
  },
  P5: {
    id: "#P5",
    name: "Completo",
    modules: ["Base", "Formaciones", "IT"],
    highlight: true,
  },
  P6: {
    id: "#P6",
    name: "Operativo+",
    modules: ["Base", "Formaciones", "Mantenimiento"],
    highlight: false,
  },
  P7: {
    id: "#P7",
    name: "Técnico Total",
    modules: ["Base", "IT", "Mantenimiento"],
    highlight: false,
  },
  P8: {
    id: "#P8",
    name: "Total",
    modules: ["Base", "Formaciones", "IT", "Mantenimiento"],
    highlight: true,
  },
};

function getPlan(a: Answers): PlanDef {
  const { formaciones: f, it, manto: m } = a;
  if (!f && !it && !m) return PLANS.P1;
  if (f && !it && !m) return PLANS.P2;
  if (!f && it && !m) return PLANS.P3;
  if (!f && !it && m) return PLANS.P4;
  if (f && it && !m) return PLANS.P5;
  if (f && !it && m) return PLANS.P6;
  if (!f && it && m) return PLANS.P7;
  return PLANS.P8;
}

// ─── Quiz steps ───────────────────────────────────────────────────────────────

const STEPS: { key: Step; question: string; hint: string; yes: string; no: string }[] = [
  {
    key: "q_multihotel",
    question: "¿Gestionas varios hoteles o propiedades?",
    hint: "Cadena hotelera, grupo o varias propiedades bajo una misma operación.",
    yes: "Sí, varios hoteles",
    no: "No, un solo hotel",
  },
  {
    key: "q_formaciones",
    question: "¿Quieres que las desviaciones detectadas en auditorías generen planes de formación para el equipo?",
    hint: "El módulo de formaciones cierra el loop: FAIL → acción correctiva → formación vinculada → verificación.",
    yes: "Sí, me interesa",
    no: "No por ahora",
  },
  {
    key: "q_it",
    question: "¿Quieres que IT gestione su propio backlog de pendientes dentro del sistema?",
    hint: "IT recibe los FAILs que les corresponden, los gestiona y cierra desde su vista propia.",
    yes: "Sí",
    no: "No",
  },
  {
    key: "q_manto",
    question: "¿Quieres incluir a Mantenimiento / Engineering en el seguimiento de pendientes?",
    hint: "Igual que IT pero para el departamento de mantenimiento e ingeniería.",
    yes: "Sí",
    no: "No",
  },
];

// ─── Combination table data ────────────────────────────────────────────────────

const COMBO_TABLE = [
  { id: "#P1", name: "Esencial",        base: true,  form: false, it: false, manto: false, addons: 0, descuento: "—"   },
  { id: "#P2", name: "Operativo",       base: true,  form: true,  it: false, manto: false, addons: 1, descuento: "—"   },
  { id: "#P3", name: "Técnico IT",      base: true,  form: false, it: true,  manto: false, addons: 1, descuento: "—"   },
  { id: "#P4", name: "Técnico Manto",   base: true,  form: false, it: false, manto: true,  addons: 1, descuento: "—"   },
  { id: "#P5", name: "Completo",        base: true,  form: true,  it: true,  manto: false, addons: 2, descuento: "-10%" },
  { id: "#P6", name: "Operativo+",      base: true,  form: true,  it: false, manto: true,  addons: 2, descuento: "-10%" },
  { id: "#P7", name: "Técnico Total",   base: true,  form: false, it: true,  manto: true,  addons: 2, descuento: "-10%" },
  { id: "#P8", name: "Total",           base: true,  form: true,  it: true,  manto: true,  addons: 3, descuento: "-20%" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Check({ active }: { active: boolean }) {
  if (!active) return <span className="text-[var(--text-secondary)] opacity-30">·</span>;
  return <span className="text-[#185FA5] font-bold">✓</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PricingQuiz() {
  const [step, setStep] = useState<Step>("q_multihotel");
  const [answers, setAnswers] = useState<Answers>({
    multihotel: null,
    formaciones: null,
    it: null,
    manto: null,
  });
  const [showTable, setShowTable] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const currentStep = STEPS[currentStepIndex];

  function answer(value: boolean) {
    const key = currentStep.key.replace("q_", "") as keyof Answers;
    const next = STEPS[currentStepIndex + 1];
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (next) {
      setStep(next.key);
    } else {
      setStep("result");
    }
  }

  function restart() {
    setStep("q_multihotel");
    setAnswers({ multihotel: null, formaciones: null, it: null, manto: null });
  }

  const plan = step === "result" ? getPlan(answers) : null;
  const isMultihotel = answers.multihotel === true;

  return (
    <div className="space-y-10">

      {/* Quiz card */}
      <div
        className="rounded-[28px] p-8 lg:p-10"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        {step !== "result" ? (
          <>
            {/* Progress */}
            <div className="mb-8 flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s.key}
                  className="h-1 flex-1 rounded-full transition-all"
                  style={{
                    background: i <= currentStepIndex ? "#185FA5" : "var(--border)",
                  }}
                />
              ))}
            </div>

            {/* Step label */}
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-secondary)]">
              Pregunta {currentStepIndex + 1} de {STEPS.length}
            </div>

            {/* Question */}
            <h2 className="mt-3 text-xl font-bold text-[var(--text)] lg:text-2xl">
              {currentStep.question}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {currentStep.hint}
            </p>

            {/* Buttons */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => answer(true)}
                className="rounded-[12px] px-6 py-4 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
              >
                <span className="mr-2 text-[#185FA5]">→</span>
                {currentStep.yes}
              </button>
              <button
                onClick={() => answer(false)}
                className="rounded-[12px] px-6 py-4 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[#185FA5]"
                style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
              >
                <span className="mr-2 text-[var(--text-secondary)]">→</span>
                {currentStep.no}
              </button>
            </div>
          </>
        ) : (
          // Result
          plan && (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-[2px] text-[#185FA5]">
                Plan recomendado
              </div>

              <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">
                    {plan.name}
                    {isMultihotel && <span className="ml-3 text-lg font-semibold text-[var(--text-secondary)]">· Cadena</span>}
                  </h2>
                  <div className="mt-1 font-mono text-sm text-[var(--text-secondary)]">
                    {plan.id}{isMultihotel ? "-M" : ""}
                  </div>
                </div>
                <div
                  className="rounded-[12px] px-5 py-3 text-right"
                  style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--text-secondary)]">Precio</div>
                  <div className="mt-1 text-lg font-bold text-[var(--text)]">Por definir</div>
                </div>
              </div>

              {/* Modules */}
              <div className="mt-8 flex flex-wrap gap-2">
                {plan.modules.map((m) => (
                  <span
                    key={m}
                    className="rounded-full px-4 py-1.5 text-sm font-medium"
                    style={{ background: "#EBF3FC", color: "#185FA5", border: "1px solid #C3DCEE" }}
                  >
                    {m}
                  </span>
                ))}
                {isMultihotel && (
                  <span
                    className="rounded-full px-4 py-1.5 text-sm font-medium"
                    style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}
                  >
                    Multihotel / Cadena
                  </span>
                )}
              </div>

              {/* Bundle note */}
              {plan.modules.length >= 3 && (
                <div
                  className="mt-6 rounded-[10px] px-5 py-3 text-sm text-[var(--text-secondary)]"
                  style={{ background: "var(--row-bg)", border: "1px solid var(--border)" }}
                >
                  Con {plan.modules.length - 1} módulos adicionales aplica descuento bundle sobre precio unitario de cada módulo.
                </div>
              )}

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className="rounded-[8px] bg-[#185FA5] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#378ADD]"
                >
                  Concertar cita
                </Link>
                <button
                  onClick={restart}
                  className="rounded-[8px] px-6 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text)]"
                  style={{ border: "1px solid var(--border)" }}
                >
                  Volver a empezar
                </button>
              </div>
            </>
          )
        )}
      </div>

      {/* Combination table */}
      <div>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text)]"
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-xs transition"
            style={{ border: "1px solid var(--border)" }}
          >
            {showTable ? "−" : "+"}
          </span>
          Tabla de combinaciones y precios de referencia
        </button>

        {showTable && (
          <div className="mt-5 overflow-x-auto rounded-[20px]" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr style={{ background: "var(--row-bg)", borderBottom: "1px solid var(--border)" }}>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">ID</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">Plan</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">Base</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">Formaciones</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">IT</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">Manto</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">Descuento</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-secondary)]">Precio/mes</th>
                </tr>
              </thead>
              <tbody>
                {COMBO_TABLE.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < COMBO_TABLE.length - 1 ? "1px solid var(--border)" : undefined,
                      background: row.addons >= 2 ? "rgba(24,95,165,0.03)" : undefined,
                    }}
                  >
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-[#185FA5]">{row.id}</td>
                    <td className="px-5 py-3 font-semibold text-[var(--text)]">{row.name}</td>
                    <td className="px-4 py-3 text-center"><Check active={row.base} /></td>
                    <td className="px-4 py-3 text-center"><Check active={row.form} /></td>
                    <td className="px-4 py-3 text-center"><Check active={row.it} /></td>
                    <td className="px-4 py-3 text-center"><Check active={row.manto} /></td>
                    <td className="px-4 py-3 text-center text-xs font-semibold" style={{ color: row.descuento !== "—" ? "#15803D" : "var(--text-secondary)" }}>
                      {row.descuento}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-[var(--text-secondary)]">Por definir</td>
                  </tr>
                ))}
                {/* Multihotel row note */}
                <tr style={{ background: "var(--row-bg)", borderTop: "1px solid var(--border)" }}>
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-[#15803D]">#Pn-M</td>
                  <td className="px-5 py-3 text-sm font-semibold text-[var(--text)]">Cadena / Multihotel</td>
                  <td colSpan={5} className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    Cualquier plan (#P1–#P8) con tarifa por propiedad adicional
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-[var(--text-secondary)]">Por definir</td>
                </tr>
              </tbody>
            </table>

            {/* Legend */}
            <div
              className="px-5 py-4 text-xs text-[var(--text-secondary)]"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              Descuento bundle: 2 módulos add-on → −10% por módulo · 3 módulos add-on → −20% por módulo · El precio final depende también del nº de áreas, usuarios y nivel de acompañamiento.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}