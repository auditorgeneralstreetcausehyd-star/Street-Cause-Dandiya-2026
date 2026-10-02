import { NextRequest, NextResponse } from 'next/server';
import { getRecords } from '@/lib/db';
import { RecordType } from '@/lib/types';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { getOrSetCache, invalidateCache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    // 1. Rate Limiting: 120 per minute
    const rateCheck = checkRateLimit(req, 'api_records', { limit: 120, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    // 2. Authentication
    const authCheck = requireAuth(req);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type');
    const type = typeParam === 'PASS' || typeParam === 'DONATION' ? (typeParam as RecordType) : undefined;
    const eventId = searchParams.get('eventId') || undefined;
    const division = searchParams.get('division') || undefined;
    const date = searchParams.get('date') || undefined;
    const hour = searchParams.get('hour') || undefined;
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const cacheKey = `records_${type || 'ALL'}_${eventId || 'ALL'}_${division || 'ALL'}_${date || 'ALL'}_${hour || 'ALL'}_${search}_${limit}_${offset}`;

    if (forceRefresh) {
      invalidateCache(cacheKey);
    }

    // 3. Cached fetch (30 seconds TTL)
    const { data: result, isCached, ageSeconds } = await getOrSetCache(
      cacheKey,
      () => getRecords({ type, eventId, division, date, hour, search, limit, offset }),
      30
    );

    return NextResponse.json({
      success: true,
      records: result.records,
      total: result.total,
      limit,
      offset,
      isCached,
      cacheAgeSeconds: ageSeconds,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
