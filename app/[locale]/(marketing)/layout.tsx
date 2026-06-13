import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import HtmlLang from "@/app/(marketing)/_components/HtmlLang";
import MarketingFooter from "@/app/(marketing)/_components/MarketingFooter";
import MarketingHeader from "@/app/(marketing)/_components/MarketingHeader";
import { routing } from "@/i18n/routing";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "metadata" });
  return {
    title: { default: t("title"), template: "%s | ServiceControl" },
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      locale: params.locale === "es" ? "es_ES" : "en_US",
      type: "website",
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function MarketingLocaleLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  setRequestLocale(params.locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={params.locale}>
      <HtmlLang locale={params.locale} />
      <div
        className="marketing-layout min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased"
      >
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_72%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[160px] border-b border-black/[0.04] bg-white/[0.28]" />
          <div className="relative z-[1]">
            <MarketingHeader />
            {children}
            <MarketingFooter />
          </div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
