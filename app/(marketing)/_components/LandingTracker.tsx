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
      if (pct >= 100 && !fired.has(100)) {
        fired.add(100);
        posthog.capture("landing_scroll_depth", { depth: 100 });
      }
    }

    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";

      if (href === "/demo" || href === "/trial") {
        posthog.capture("landing_cta_click", {
          href,
          label: anchor.textContent?.trim() ?? null,
        });
      }

      if (href === "/pricing" || href.startsWith("/pricing")) {
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