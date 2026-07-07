"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { captureIfLoaded, getStoredConsent, initPostHog } from "@/lib/analytics/posthog";

export { CONSENT_COOKIE, getStoredConsent, initPostHog } from "@/lib/analytics/posthog";

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    captureIfLoaded("$pageview", { $current_url: window.location.href });
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
    <>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </>
  );
}
