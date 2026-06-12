"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export default function LandingTracker() {
  useEffect(() => {
    const fired = new Set<number>();

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = Math.round((scrolled / total) * 100);

      if (pct >= 50 && !fired.has(50)) {
        fired.add(50);
        posthog.capture("landing_scroll_depth", { depth: 50 });
      }
      // 90% como "fin de página": el 100% exacto casi nunca dispara
      // (scrollHeight incluye el footer y los redondeos juegan en contra)
      if (pct >= 90 && !fired.has(90)) {
        fired.add(90);
        posthog.capture("landing_scroll_depth", { depth: 90 });
      }
    }

    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";

      // endsWith: los Link de next-intl prefijan el locale (/en/demo)
      if (href.endsWith("/demo") || href.endsWith("/trial")) {
        posthog.capture("landing_cta_click", {
          href,
          label: anchor.textContent?.trim() ?? null,
        });
      }

      if (href.includes("/pricing")) {
        posthog.capture("landing_pricing_click", {
          href,
          label: anchor.textContent?.trim() ?? null,
        });
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}