import { setRequestLocale } from "next-intl/server";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";
import PricingQuiz from "@/app/(marketing)/_components/PricingQuiz";

function PricingPageContent() {
  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-[860px]">
        <SectionIntro
          eyebrow="Pricing"
          title="¿Qué necesita tu operación?"
          description="Responde 4 preguntas y te mostramos el plan que mejor encaja. El precio varía según módulos, número de áreas y nivel de acompañamiento."
        />

        <div className="mt-12">
          <PricingQuiz />
        </div>
      </div>
    </main>
  );
}

export default function PricingPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <PricingPageContent />;
}