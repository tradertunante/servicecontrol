import { setRequestLocale } from "next-intl/server";
import BenefitsSection from "@/app/(marketing)/_components/BenefitsSection";
import DemoShowcase from "@/app/(marketing)/_components/DemoShowcase";
import FeatureGrid from "@/app/(marketing)/_components/FeatureGrid";
import FinalCTA from "@/app/(marketing)/_components/FinalCTA";
import HeroSection from "@/app/(marketing)/_components/HeroSection";
import HowItWorksSection from "@/app/(marketing)/_components/HowItWorksSection";
import ProblemSection from "@/app/(marketing)/_components/ProblemSection";
import SolutionSection from "@/app/(marketing)/_components/SolutionSection";

export default function MarketingHomePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <BenefitsSection />
      <HowItWorksSection />
      <FeatureGrid />
      <DemoShowcase />
      <FinalCTA />
    </main>
  );
}
