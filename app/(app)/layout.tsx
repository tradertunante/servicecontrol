import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import HotelHeader from "@/app/components/HotelHeader";
import HelpButton from "@/app/components/HelpButton";
import OnboardingProvider from "@/app/providers/OnboardingProvider";
import OnboardingTour from "@/app/components/OnboardingTour";
import TrialBanner from "@/app/components/TrialBanner";
import { requireAuthenticatedUser } from "@/lib/auth/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser();

  const cookieStore = await cookies();
  const locale = (cookieStore.get("sc-locale")?.value ?? "en") as "en" | "es";
  const messages = locale === "es"
    ? (await import("@/messages/es.json")).default
    : (await import("@/messages/en.json")).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-[var(--bg)]">
        <TrialBanner />
        <HotelHeader />
        <OnboardingProvider>
          <OnboardingTour />
          <main className="pt-16 px-6 max-w-[1400px] mx-auto">{children}</main>
        </OnboardingProvider>
        <HelpButton />
      </div>
    </NextIntlClientProvider>
  );
}
