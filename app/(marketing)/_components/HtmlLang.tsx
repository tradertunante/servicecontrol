"use client";

import { useEffect } from "react";

// The root layout hardcodes <html lang="es"> and sits above the [locale]
// segment, so it cannot read the locale. Sync it client-side for /en.
export default function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}