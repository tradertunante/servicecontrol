"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

export const CONSENT_COOKIE = "sc_cookie_consent";

export function getStoredConsent(): "granted" | "denied" | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)sc_cookie_consent=([^;]+)/);
  return (match?.[1] as "granted" | "denied") ?? null;
}

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    loaded(ph) {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        ph.setPersonProperties({ is_internal: true });
      }
    },
  });
}

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!posthog.__loaded) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (getStoredConsent() === "granted") {
      initPostHog();
    }
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </PHProvider>
  );
}