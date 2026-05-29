const store = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_1000) return;
  lastCleanup = now;
  for (const [key, val] of store) {
    if (now > val.resetAt) store.delete(key);
  }
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export const RATE_LIMITS = {
  api: { windowMs: 60_000, max: 60 },       // 60 req/min for general API
  auth: { windowMs: 15 * 60_000, max: 10 },  // 10 req/15min for auth
  upload: { windowMs: 60_000, max: 10 },      // 10 uploads/min
  comment: { windowMs: 60_000, max: 5 },      // 5 comments/min
  search: { windowMs: 60_000, max: 30 },      // 30 searches/min
} as const;

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanupExpired();
  const now = Date.now();
  const key = `${identifier}`;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

export function getRateLimitHeaders(result: { remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
