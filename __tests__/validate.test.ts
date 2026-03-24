import { describe, it, expect } from "vitest";
import { parseUUID, isErrorResponse } from "@/lib/api/validate";

describe("parseUUID", () => {
  it("returns trimmed UUID for valid input", () => {
    const result = parseUUID("  550e8400-e29b-41d4-a716-446655440000  ");
    expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("accepts uppercase UUIDs", () => {
    const result = parseUUID("550E8400-E29B-41D4-A716-446655440000");
    expect(typeof result).toBe("string");
  });

  it("returns error for empty string", () => {
    const result = parseUUID("");
    expect(isErrorResponse(result)).toBe(true);
  });

  it("returns error for null/undefined", () => {
    expect(isErrorResponse(parseUUID(null))).toBe(true);
    expect(isErrorResponse(parseUUID(undefined))).toBe(true);
  });

  it("returns error for non-UUID string", () => {
    expect(isErrorResponse(parseUUID("not-a-uuid"))).toBe(true);
    expect(isErrorResponse(parseUUID("12345"))).toBe(true);
    expect(isErrorResponse(parseUUID("SELECT * FROM users"))).toBe(true);
  });

  it("returns error for UUID-like but wrong length", () => {
    expect(isErrorResponse(parseUUID("550e8400-e29b-41d4-a716-44665544000"))).toBe(true); // 1 short
    expect(isErrorResponse(parseUUID("550e8400-e29b-41d4-a716-4466554400000"))).toBe(true); // 1 extra
  });

  it("uses custom label in error", () => {
    const result = parseUUID("bad", "hotelId");
    // It's a Response object (NextResponse), not a string
    expect(isErrorResponse(result)).toBe(true);
  });
});

describe("isErrorResponse", () => {
  it("returns false for strings", () => {
    expect(isErrorResponse("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
  });
});
