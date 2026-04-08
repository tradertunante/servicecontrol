import HotelHeader from "@/app/components/HotelHeader";
import OnboardingProvider from "@/app/providers/OnboardingProvider";
import OnboardingTour from "@/app/components/OnboardingTour";
import { requireAuthenticatedUser } from "@/lib/auth/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <HotelHeader />
      <OnboardingProvider>
        <OnboardingTour />
        <main className="pt-16 px-6 max-w-[1400px] mx-auto">{children}</main>
      </OnboardingProvider>
    </div>
  );
}
