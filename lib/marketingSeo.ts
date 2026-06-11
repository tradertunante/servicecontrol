import type { Metadata } from "next";

// Canonical + hreflang for marketing pages. Relative URLs resolve
// against metadataBase (app/layout.tsx).
export function localeAlternates(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      es: `/es${path}`,
      en: `/en${path}`,
      "x-default": `/es${path}`,
    },
  };
}