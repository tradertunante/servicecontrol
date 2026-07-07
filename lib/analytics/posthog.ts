"use client";

import type { PostHog } from "posthog-js";

export const CONSENT_COOKIE = "sc_cookie_consent";

export function getStoredConsent(): "granted" | "denied" | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)sc_cookie_consent=([^;]+)/);
  return (match?.[1] as "granted" | "denied") ?? null;
}

// posthog-js pesa ~50 kB gz y estaba en el bundle compartido de todas las
// páginas. Se carga bajo demanda: solo con consentimiento y cuando hace falta.
let client: PostHog | null = null;
let loadPromise: Promise<PostHog | null> | null = null;

async function loadPostHog(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  if (client) return client;

  if (!loadPromise) {
    loadPromise = import("posthog-js")
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) {
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
        client = posthog;
        return posthog;
      })
      .catch(() => {
        loadPromise = null;
        return null;
      });
  }

  return loadPromise;
}

export function initPostHog(): void {
  void loadPostHog();
}

export function capture(...args: Parameters<PostHog["capture"]>): void {
  if (client) {
    client.capture(...args);
    return;
  }
  if (getStoredConsent() !== "granted") return;
  void loadPostHog().then((ph) => ph?.capture(...args));
}

// Igual que capture, pero sin encolar si posthog aún no está cargado.
// Replica el comportamiento previo del pageview tracker (posthog.__loaded).
export function captureIfLoaded(...args: Parameters<PostHog["capture"]>): void {
  client?.capture(...args);
}

export function identify(...args: Parameters<PostHog["identify"]>): void {
  if (client) {
    client.identify(...args);
    return;
  }
  if (getStoredConsent() !== "granted") return;
  void loadPostHog().then((ph) => ph?.identify(...args));
}
