import Link from "next/link";

function MetricCard({
  value,
  label,
  tone = "default",
}: {
  value: string;
  label: string;
  tone?: "default" | "alert";
}) {
  const accent =
    tone === "alert"
      ? "border-amber-300/40 bg-amber-50 text-amber-700"
      : "border-white/10 bg-white/[0.06] text-slate-300";

  return (
    <div className={`rounded-[22px] border p-5 ${accent}`}>
      <div className="text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-1 text-sm">{label}</div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="px-5 pb-20 pt-8 sm:px-8 lg:px-10 lg:pb-24 lg:pt-10">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(560px,0.9fr)] lg:items-center">
        <div className="max-w-[820px]">
          <div className="inline-flex rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 px-4 py-2 text-sm font-bold text-slate-600 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
            Plataforma SaaS para operacion y calidad hotelera
          </div>

          <h1 className="mt-7 max-w-[14ch] text-[clamp(3.6rem,9vw,6.8rem)] font-extrabold leading-[0.94] tracking-[-0.05em] text-slate-950">
            Controla la calidad de tu hotel en tiempo real.
          </h1>

          <p className="mt-7 max-w-[720px] text-[clamp(1.125rem,2vw,1.45rem)] leading-8 text-slate-600">
            Detecta fallos, ejecuta auditorias y mejora la operacion sin caos ni Excel.
            ServiceControl centraliza auditorias, reauditorias, formacion y seguimiento
            del equipo en una sola plataforma.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/demo"
              className="rounded-full bg-slate-950 px-7 py-4 text-base font-extrabold text-white shadow-[0_16px_40px_rgba(15,23,42,0.22)] transition hover:bg-slate-800"
            >
              Solicitar demo
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-black/10 bg-white/70 px-7 py-4 text-base font-bold text-slate-700 transition hover:border-black/20 hover:bg-white"
            >
              Acceder a la app
            </Link>
          </div>

          <div className="mt-10 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-[24px] border border-black/8 bg-white/72 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-500">
                Visibilidad real
              </div>
              <p className="mt-3 text-base leading-7">
                Score por area, backlog correctivo y focos rojos visibles para operaciones.
              </p>
            </div>
            <div className="rounded-[24px] border border-black/8 bg-white/72 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-500">
                Ejecucion diaria
              </div>
              <p className="mt-3 text-base leading-7">
                Auditorias desde movil con evidencia y seguimiento sin depender de memoria.
              </p>
            </div>
            <div className="rounded-[24px] border border-black/8 bg-white/72 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-500">
                Sistema unico
              </div>
              <p className="mt-3 text-base leading-7">
                Calidad, reauditorias y formacion conectadas en un solo flujo.
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-x-14 top-6 h-32 rounded-full bg-[rgba(172,143,95,0.18)] blur-3xl" />
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.26)] sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Hotel Overview
                </div>
                <div className="mt-2 text-3xl font-extrabold tracking-tight">
                  Calidad operativa hoy
                </div>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
                En seguimiento
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <MetricCard value="91%" label="Score global del hotel" />
              <MetricCard value="6" label="Hallazgos activos con seguimiento" tone="alert" />
              <MetricCard value="14" label="Reauditorias programadas esta semana" />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-400">Areas criticas</div>
                    <div className="mt-1 text-xl font-bold">Housekeeping, Cocina fria, Recepcion</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400">Ultima auditoria</div>
                    <div className="mt-1 text-base font-bold">Hace 45 min</div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    { area: "Housekeeping", score: "84%", width: "84%", status: "3 hallazgos abiertos" },
                    { area: "Recepcion", score: "88%", width: "88%", status: "1 reauditoria pendiente" },
                    { area: "Spa", score: "96%", width: "96%", status: "Operacion estable" },
                  ].map((item) => (
                    <div key={item.area}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-200">{item.area}</span>
                        <span className="text-slate-400">{item.score}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-[linear-gradient(90deg,#b99259,#f0dec1)]" style={{ width: item.width }} />
                      </div>
                      <div className="mt-2 text-xs text-slate-400">{item.status}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-sm font-semibold text-slate-400">Accion correctiva prioritaria</div>
                  <div className="mt-3 text-lg font-bold">Mise en place incompleto en buffet desayuno</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Responsable: Supervisor A&B. Reauditoria prevista en 24 horas con checklist de apertura.
                  </p>
                </div>
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-400">Formacion vinculada</div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                      2 sesiones
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      "Estandares de liberacion de habitacion",
                      "Checklist de apertura Front Desk",
                    ].map((training) => (
                      <div key={training} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-200">
                        {training}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
