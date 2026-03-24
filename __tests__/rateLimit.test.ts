import { describe, it, expect, beforeEach, vi } from "vitest";

// Reset module state between tests
let checkRateLimit: typeof import("@/lib/api/rateLimit").checkRateLimit;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("@/lib/api/rateLimit");
  checkRateLimit = mod.checkRateLimit;
});

describe("checkRateLimit", () => {
  it("allows first request", () => {
    const result = checkRateLimit("ip-1");
    expect(result.allowed).toBe(true);
  });

  it("allows up to 100 requests", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit("ip-2").allowed).toBe(true);
    }
  });

  it("blocks request 101", () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit("ip-3");
    }
    const result = checkRateLimit("ip-3");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit("ip-4");
    }
    // ip-4 is exhausted, but ip-5 should still work
    expect(checkRateLimit("ip-5").allowed).toBe(true);
  });
});
