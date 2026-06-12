import { getTranslations, setRequestLocale } from "next-intl/server";
import SectionIntro from "@/app/(marketing)/_components/SectionIntro";
import PricingQuiz from "@/app/(marketing)/_components/PricingQuiz";

export default async function PricingPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "pricing" });

  return (
    <main className="px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto w-full max-w-6xl">
        <SectionIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12">
          <PricingQuiz />
        </div>
      </div>
    </main>
  );
}