/**
 * Simple in-memory sliding-window rate limiter for Edge/middleware.
 *
 * Limitations:
 * - Not shared across Vercel instances (each serverless function has its own map)
 * - Good enough to block brute-force and accidental loops from a single origin
 * - For production at scale, consider Vercel KV or Upstash Redis
 */

type Entry = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Entry>>();

function getStore(storeKey: string): Map<string, Entry> {
  let store = stores.get(storeKey);
  if (!store) { store = new Map(); stores.set(storeKey, store); }
  return store;
}

let lastCleanup = Date.now();
function cleanupIfNeeded(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < windowMs) return;
  lastCleanup = now;
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }
}

type RateLimitOptions = {
  windowMs?: number;
  maxRequests?: number;
  storeKey?: string;
};

/**
 * Returns { allowed: true } if the request is within limits,
 * or { allowed: false, retryAfterMs } if it should be rejected.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
): { allowed: boolean; retryAfterMs?: number } {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 100;
  const store = getStore(options.storeKey ?? "default");

  cleanupIfNeeded(windowMs);

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  return { allowed: true };
}
