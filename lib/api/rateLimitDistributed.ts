import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { checkRateLimit } from "./rateLimit";

type LimitResult = { allowed: boolean; retryAfterMs?: number };

function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Lazily created — one instance per isolate (Vercel Edge cold start)
let redis: Redis | null | undefined;
let authLimiter: Ratelimit | undefined;
let generalLimiter: Ratelimit | undefined;

function getAuthLimiter(): Ratelimit | null {
  if (authLimiter) return authLimiter;
  redis ??= makeRedis();
  if (!redis) return null;
  authLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "60 s"), prefix: "rl:auth" });
  return authLimiter;
}

function getGeneralLimiter(): Ratelimit | null {
  if (generalLimiter) return generalLimiter;
  redis ??= makeRedis();
  if (!redis) return null;
  generalLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "60 s"), prefix: "rl:api" });
  return generalLimiter;
}

/**
 * Distributed rate limiter backed by Upstash Redis.
 * Falls back to in-memory when env vars are absent (local dev / CI).
 *
 * @param key    Opaque string — use userId for per-user limits, IP for endpoint guards
 * @param store  "auth" (5/min) | "general" (100/min)
 */
export async function checkRateLimitDistributed(
  key: string,
  store: "auth" | "general" = "general",
): Promise<LimitResult> {
  const limiter = store === "auth" ? getAuthLimiter() : getGeneralLimiter();

  if (!limiter) {
    // No Upstash config — fall back to in-memory (per-instance)
    return checkRateLimit(key, {
      maxRequests: store === "auth" ? 5 : 100,
      windowMs: 60_000,
      storeKey: store,
    });
  }

  const { success, reset } = await limiter.limit(key);
  if (success) return { allowed: true };
  return { allowed: false, retryAfterMs: reset - Date.now() };
}