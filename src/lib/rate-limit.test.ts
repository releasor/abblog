import { checkRateLimit, RATE_LIMITS } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows first request", () => {
    const result = checkRateLimit("test:key1", { windowMs: 60000, max: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("tracks multiple requests", () => {
    const config = { windowMs: 60000, max: 3 };
    const id = `test:multi-${Date.now()}`;

    checkRateLimit(id, config);
    checkRateLimit(id, config);
    const result = checkRateLimit(id, config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks when limit exceeded", () => {
    const config = { windowMs: 60000, max: 2 };
    const id = `test:block-${Date.now()}`;

    checkRateLimit(id, config);
    checkRateLimit(id, config);
    const result = checkRateLimit(id, config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("uses different keys independently", () => {
    const config = { windowMs: 60000, max: 1 };
    const id1 = `test:indep1-${Date.now()}`;
    const id2 = `test:indep2-${Date.now()}`;

    checkRateLimit(id1, config);
    const result = checkRateLimit(id2, config);

    expect(result.allowed).toBe(true);
  });

  it("returns resetAt timestamp", () => {
    const before = Date.now();
    const result = checkRateLimit(`test:reset-${Date.now()}`, { windowMs: 60000, max: 5 });
    const after = Date.now();

    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
    expect(result.resetAt).toBeLessThanOrEqual(after + 60000);
  });
});

describe("RATE_LIMITS", () => {
  it("has expected rate limit configs", () => {
    expect(RATE_LIMITS.api).toEqual({ windowMs: 60000, max: 60 });
    expect(RATE_LIMITS.auth).toEqual({ windowMs: 900000, max: 10 });
    expect(RATE_LIMITS.comment).toEqual({ windowMs: 60000, max: 5 });
  });
});
