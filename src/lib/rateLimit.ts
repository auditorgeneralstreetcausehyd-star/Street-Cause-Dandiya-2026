import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Clean up stale rate limit entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetAt) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit: number; // max requests per window
  windowSeconds: number; // window duration in seconds
  identifier?: string;
}

/**
 * Check and enforce rate limiting based on client IP & action key
 */
export function checkRateLimit(
  req: NextRequest,
  actionKey: string,
  options: RateLimitOptions = { limit: 60, windowSeconds: 60 }
): { allowed: boolean; remaining: number; resetInSeconds: number; response?: NextResponse } {
  // Extract client IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');

  const key = `${actionKey}:${options.identifier || ip}`;
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  let record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    record = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryStore.set(key, record);
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetInSeconds: options.windowSeconds,
    };
  }

  record.count++;

  const remaining = Math.max(0, options.limit - record.count);
  const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);

  if (record.count > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
      response: NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Please wait ${resetInSeconds} second(s) before trying again.`,
          retryAfter: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(resetInSeconds),
            'X-RateLimit-Limit': String(options.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
          },
        }
      ),
    };
  }

  return {
    allowed: true,
    remaining,
    resetInSeconds,
  };
}
