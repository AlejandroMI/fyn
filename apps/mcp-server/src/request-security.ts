const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_REQUEST_LIMIT = 12;
export const MAX_MCP_REQUEST_BYTES = 64 * 1024;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

const globalRateLimitStore = globalThis as typeof globalThis & {
  __fynRateLimits?: Map<string, RateLimitEntry>;
};

const rateLimits = globalRateLimitStore.__fynRateLimits ?? new Map<string, RateLimitEntry>();
globalRateLimitStore.__fynRateLimits = rateLimits;

export function clientIpFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-vercel-forwarded-for"] ?? headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || "unknown";
}

export function checkRateLimit(
  key: string,
  limit = DEFAULT_REQUEST_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const existing = rateLimits.get(key);
  const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  entry.count += 1;
  rateLimits.set(key, entry);

  if (rateLimits.size > 5_000) {
    for (const [storedKey, storedEntry] of rateLimits) {
      if (storedEntry.resetAt <= now) rateLimits.delete(storedKey);
    }
  }

  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
  };
}

export function approximateBodyBytes(body: unknown): number {
  if (body === undefined || body === null) return 0;
  if (typeof body === "string") return Buffer.byteLength(body);

  try {
    return Buffer.byteLength(JSON.stringify(body));
  } catch {
    return MAX_MCP_REQUEST_BYTES + 1;
  }
}
