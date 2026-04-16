import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import MarketingFooter from "@/app/(marketing)/_components/MarketingFooter";
import MarketingHeader from "@/app/(marketing)/_components/MarketingHeader";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "metadata" });
  return {
    title: { default: t("title"), template: "%s | ServiceControl" },
    description: t("description"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function MarketingLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={params.locale}>
      <div
        className="marketing-layout min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased"
      >
        <div className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_72%)]" />
          <div className="absolute inset-x-0 top-0 h-[160px] border-b border-black/[0.04] bg-white/[0.28]" />
          <MarketingHeader />
          {children}
          <MarketingFooter />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
