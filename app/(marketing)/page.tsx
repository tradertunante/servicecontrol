import DemoShowcase from "./_components/DemoShowcase";
import FeatureGrid from "./_components/FeatureGrid";
import FinalCTA from "./_components/FinalCTA";
import HeroSection from "./_components/HeroSection";
import HowItWorksSection from "./_components/HowItWorksSection";
import ProblemSection from "./_components/ProblemSection";
import SolutionSection from "./_components/SolutionSection";

export default function MarketingHomePage() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <SolutionSection />
      <DemoShowcase />
      <FeatureGrid />
      <FinalCTA />
    </main>
  );
}
