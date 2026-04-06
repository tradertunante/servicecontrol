import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28">
      <div
        className="mx-auto w-full max-w-[1480px] rounded-[28px] px-6 py-12 text-white sm:px-8 lg:px-12 lg:py-14"
        style={{
          background: "rgba(15,23,42,0.96)",
          border: "1px solid var(--dark-border-subtle)",
          boxShadow: "var(--dark-shadow)",
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-[860px]">
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/60">
              El siguiente paso
            </div>
            <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
              Si hoy dependes de Excel, reportes o seguimiento manual,
              <span className="block text-white/50"> no tienes control. Tienes friccion.</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Te mostramos como recuperar el control de tu operacion. Sin adaptar tu hotel
              a un software. Al reves.
            </p>
            <p className="mt-4 text-base leading-7 text-white/40">
              Cada semana sin sistema de seguimiento es una semana en la que los errores
              se normalizan silenciosamente.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Link
              href="/demo"
              className="rounded-xl border border-white/12 bg-white px-7 py-4 text-center text-base font-black text-black transition hover:bg-white/90"
            >
              Solicitar demo guiada
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-white/14 px-7 py-4 text-center text-base font-black text-white transition hover:bg-white/8"
            >
              Ver propuesta de precio
            </Link>
          </div>
        </div>

        {/* Bottom proof strip */}
        <div
          className="mt-10 grid gap-4 border-t pt-8 text-sm text-white/50 sm:grid-cols-3"
          style={{ borderColor: "rgba(255,255,255,0.10)" }}
        >
          {[
            "Configuracion adaptada a tu operacion real, no a una plantilla generica.",
            "Acompanamiento en implantacion para direccion, operaciones y calidad.",
            "Plataforma completa: auditorias, reauditorias, acciones y formacion.",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3">
              <span className="mt-1 text-white/30">—</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
