import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",

  // Performance — sample 10% of transactions in prod
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay — skip if developer cookie is set (document.cookie = "sentry_skip_replay=1; max-age=31536000; path=/")
  replaysSessionSampleRate: typeof document !== "undefined" && document.cookie.includes("sentry_skip_replay=1") ? 0 : 0.01,
  replaysOnErrorSampleRate: typeof document !== "undefined" && document.cookie.includes("sentry_skip_replay=1") ? 0 : 1.0,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Don't send in development unless DSN is explicitly set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
