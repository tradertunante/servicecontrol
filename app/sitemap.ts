import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE = "https://servicecontrol.com";
const MARKETING_ROUTES = ["", "/pricing", "/demo", "/trial"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    MARKETING_ROUTES.map((route) => ({
      url: `${BASE}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${BASE}/${l}${route}`])
        ),
      },
    }))
  );
}