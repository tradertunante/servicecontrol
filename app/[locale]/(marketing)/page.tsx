import { setRequestLocale } from "next-intl/server";
import BenefitsSection from "@/app/(marketing)/_components/BenefitsSection";
import DemoShowcase from "@/app/(marketing)/_components/DemoShowcase";
import FeatureGrid from "@/app/(marketing)/_components/FeatureGrid";
import FinalCTA from "@/app/(marketing)/_components/FinalCTA";
import HeroSection from "@/app/(marketing)/_components/HeroSection";
import HowItWorksSection from "@/app/(marketing)/_components/HowItWorksSection";
import LandingTracker from "@/app/(marketing)/_components/LandingTracker";
import ProblemSection from "@/app/(marketing)/_components/ProblemSection";
import SolutionSection from "@/app/(marketing)/_components/SolutionSection";

export default async function MarketingHomePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  setRequestLocale(params.locale);
  return (
    <main>
      <LandingTracker />
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
