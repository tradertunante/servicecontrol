import Link from "next/link";
import SectionIntro from "./SectionIntro";
import { ProductOperationsMock } from "./MarketingShowcase";

export default function DemoShowcase() {
  return (
    <section id="demo" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
      <div
        className="mx-auto w-full max-w-[1480px] rounded-[28px] p-6 sm:p-8 lg:p-10"
        style={{
          background: "rgba(255,255,255,0.58)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="max-w-[680px]">
            <SectionIntro
              eyebrow="Prueba visual"
              title="Una vista de calidad diseñada para tomar decisiones rapidas."
              description="La demo muestra la operacion por area, el estado de hallazgos, reauditorias y formacion en una composicion clara, sobria y ejecutiva."
            />
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/demo"
                className="rounded-xl border border-black/15 bg-black px-7 py-4 text-base font-black text-white transition hover:bg-[#111827]"
              >
                Ver demo
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-black/15 bg-white px-7 py-4 text-base font-black text-black transition hover:bg-black hover:text-white"
              >
                Ver planes
              </Link>
            </div>
          </div>

          <ProductOperationsMock />
        </div>
      </div>
    </section>
  );
}
