import { vi } from "vitest";
import { checkRateLimit, getRateLimitHeaders } from "../rate-limit";

// Clear the store before each test
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows first request", () => {
    const result = checkRateLimit("test-key", { windowMs: 60000, max: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("tracks multiple requests", () => {
    const config = { windowMs: 60000, max: 3 };
    checkRateLimit("test-key-2", config);
    checkRateLimit("test-key-2", config);
    const result = checkRateLimit("test-key-2", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks when limit exceeded", () => {
    const config = { windowMs: 60000, max: 2 };
    checkRateLimit("test-key-3", config);
    checkRateLimit("test-key-3", config);
    const result = checkRateLimit("test-key-3", config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const config = { windowMs: 1000, max: 1 };
    checkRateLimit("test-key-4", config);
    const blocked = checkRateLimit("test-key-4", config);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    const allowed = checkRateLimit("test-key-4", config);
    expect(allowed.allowed).toBe(true);
  });

  it("isolates different keys", () => {
    const config = { windowMs: 60000, max: 1 };
    checkRateLimit("key-a", config);
    const result = checkRateLimit("key-b", config);
    expect(result.allowed).toBe(true);
  });
});

describe("getRateLimitHeaders", () => {
  it("returns correct headers", () => {
    const headers = getRateLimitHeaders({ remaining: 5, resetAt: 1700000000000 });
    expect(headers["X-RateLimit-Remaining"]).toBe("5");
    expect(headers["X-RateLimit-Reset"]).toBe("1700000000");
  });
});
