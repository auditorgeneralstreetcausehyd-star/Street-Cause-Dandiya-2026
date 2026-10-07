import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from './db';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Fallback only: per-process counters don't hold across serverless instances
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

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  response?: NextResponse;
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  return forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '127.0.0.1');
}

let warnedSharedUnavailable = false;

// Shared counter in Supabase (rate_limit_hit in supabase/security_hardening.sql); null if unavailable
async function hitShared(key: string, windowSeconds: number): Promise<{ count: number; resetAt: number } | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('rate_limit_hit', { p_key: key, p_window_seconds: windowSeconds });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      if (!warnedSharedUnavailable) {
        warnedSharedUnavailable = true;
        console.warn(
          `Shared rate limiting unavailable (${error?.message || 'no data'}); using per-instance memory. ` +
            'Run supabase/security_hardening.sql to enable it.'
        );
      }
      return null;
    }
    return { count: row.hit_count, resetAt: new Date(row.window_reset_at).getTime() };
  } catch {
    return null;
  }
}

function hitMemory(key: string, windowSeconds: number): { count: number; resetAt: number } {
  const now = Date.now();
  let record = memoryStore.get(key);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowSeconds * 1000 };
    memoryStore.set(key, record);
  }
  record.count++;
  return { count: record.count, resetAt: record.resetAt };
}

/**
 * Read-only: is this client already over the limit for this action? Used to count only failures
 * (e.g. wrong passcodes) while still blocking a client that has failed too often, even on a correct guess.
 */
export async function isRateLimited(req: NextRequest, actionKey: string, options: RateLimitOptions): Promise<boolean> {
  const key = `${actionKey}:${options.identifier || getClientIp(req)}`;
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('rate_limits').select('count, reset_at').eq('key', key).maybeSingle();
    if (!error) {
      return Boolean(data && new Date(data.reset_at).getTime() > Date.now() && data.count >= options.limit);
    }
  }
  const record = memoryStore.get(key);
  return Boolean(record && Date.now() <= record.resetAt && record.count >= options.limit);
}

/**
 * Count one hit for this client & action and enforce the limit.
 * Uses the shared Supabase counter so limits hold across serverless instances; falls back to memory.
 */
export async function checkRateLimit(
  req: NextRequest,
  actionKey: string,
  options: RateLimitOptions = { limit: 60, windowSeconds: 60 }
): Promise<RateLimitResult> {
  const key = `${actionKey}:${options.identifier || getClientIp(req)}`;
  const hit = (await hitShared(key, options.windowSeconds)) || hitMemory(key, options.windowSeconds);

  const remaining = Math.max(0, options.limit - hit.count);
  const resetInSeconds = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));

  if (hit.count > options.limit) {
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
            'X-RateLimit-Reset': String(Math.ceil(hit.resetAt / 1000)),
          },
        }
      ),
    };
  }

  return { allowed: true, remaining, resetInSeconds };
}
