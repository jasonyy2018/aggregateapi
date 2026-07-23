/**
 * In-memory sliding-window rate limiter for API keys.
 *
 * This is a simple implementation suitable for single-instance deployments.
 * For multi-instance deployments, consider Redis or a distributed rate limiter.
 */

const windows = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param apiKeyId - The API key identifier
 * @param limitPerMinute - Maximum requests per minute
 * @returns Rate limit result with allowed status, remaining requests, and reset time
 */
export function checkRateLimit(apiKeyId: string, limitPerMinute: number): RateLimitResult {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const timestamps = windows.get(apiKeyId) ?? [];
  const cutOff = now - windowMs;

  // Filter out old timestamps outside the window
  const recent = timestamps.filter((t) => t > cutOff);
  windows.set(apiKeyId, recent);

  const used = recent.length;
  const allowed = used < limitPerMinute;

  // Only add timestamp if request is allowed
  if (allowed) {
    recent.push(now);
  }

  const resetAt = new Date(recent[0] + windowMs);

  return {
    allowed,
    remaining: Math.max(0, limitPerMinute - used - (allowed ? 1 : 0)),
    resetAt,
  };
}

/**
 * Start periodic cleanup of expired rate limit windows.
 *
 * @param intervalMs - Cleanup interval in milliseconds (default: 2 minutes)
 */
export function startRateLimitCleanup(intervalMs = 120_000): void {
  setInterval(() => {
    const now = Date.now() - 120_000; // Keep 2 minutes of safety margin

    for (const [key, timestamps] of windows.entries()) {
      // Remove entries where all timestamps are older than the safety margin
      if (timestamps.every((t) => t < now)) {
        windows.delete(key);
      }
    }
  }, intervalMs);
}
