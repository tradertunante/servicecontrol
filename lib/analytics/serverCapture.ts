import "server-only";

import { logger } from "@/lib/logger";

/**
 * Captura de eventos de analítica desde rutas server-side (checkout, webhook).
 *
 * No usamos el SDK posthog-node para no añadir una dependencia nueva solo para
 * un puñado de eventos: PostHog acepta eventos por HTTP directo con la misma
 * clave pública que usa el cliente (NEXT_PUBLIC_POSTHOG_KEY).
 *
 * Best-effort: nunca debe bloquear ni romper un flujo de cobro. Si falla,
 * se registra como warning y se descarta.
 */
export async function captureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

  try {
    const res = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $process_person_profile: false },
      }),
    });
    if (!res.ok) {
      logger.warn("server_capture_failed", { event, status: res.status });
    }
  } catch (err) {
    logger.warn("server_capture_error", {
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
