"use client";

import { useTranslations } from "next-intl";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app.common");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <h2 className="text-lg font-bold">{t("error")}</h2>
      <p className="text-sm opacity-70 text-center max-w-md">
        {error.message || t("errorDesc")}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-xl border border-black/15 bg-white text-black font-bold text-sm hover:bg-black hover:text-white transition-all"
      >
        {t("retry")}
      </button>
    </div>
  );
}
