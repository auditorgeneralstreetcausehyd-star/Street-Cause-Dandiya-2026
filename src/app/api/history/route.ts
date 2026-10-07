import { NextRequest, NextResponse } from 'next/server';
import { getImportBatches } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { getOrSetCache, invalidateCache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    // 1. Rate Limiting: 60 per minute
    const rateCheck = await checkRateLimit(req, 'api_history', { limit: 60, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    // 2. Authentication
    const authCheck = requireAuth(req);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const cacheKey = `history_batches_${eventId || 'ALL'}`;
    if (forceRefresh) {
      invalidateCache(cacheKey);
    }

    const { data: batches } = await getOrSetCache(
      cacheKey,
      () => getImportBatches(eventId),
      45
    );

    return NextResponse.json({ success: true, batches });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
