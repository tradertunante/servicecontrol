/**
 * Simple in-memory sliding-window rate limiter for Edge/middleware.
 *
 * Limitations:
 * - Not shared across Vercel instances (each serverless function has its own map)
 * - Good enough to block brute-force and accidental loops from a single origin
 * - For production at scale, consider Vercel KV or Upstash Redis
 */

const windowMs = 60_000; // 1 minute window
const maxRequests = 100; // max requests per window per key

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Periodically clean expired entries to prevent memory leak
let lastCleanup = Date.now();
function cleanupIfNeeded() {
  const now = Date.now();
  if (now - lastCleanup < windowMs) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Returns { allowed: true } if the request is within limits,
 * or { allowed: false, retryAfterMs } if it should be rejected.
 */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  cleanupIfNeeded();

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
