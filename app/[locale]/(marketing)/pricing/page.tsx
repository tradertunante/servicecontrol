import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";
import PricingQuiz from "@/app/(marketing)/_components/PricingQuiz";
import { localeAlternates } from "@/lib/marketingSeo";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  return { alternates: localeAlternates(params.locale, "/pricing") };
}

function PricingPageContent() {
  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-6xl">
        <SectionIntro
          eyebrow="Pricing"
          title="Control operativo real, en el plan que encaja con tu hotel"
          description="Tres planes pensados para distintos niveles de complejidad. El precio final depende del número de áreas, usuarios y nivel de acompañamiento."
        />

        <div className="mt-12">
          <PricingQuiz />
        </div>
      </div>
    </main>
  );
}

export default async function PricingPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  setRequestLocale(params.locale);
  return <PricingPageContent />;
}