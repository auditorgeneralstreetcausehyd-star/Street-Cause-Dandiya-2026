import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats, getSettings, isUsingSupabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { getOrSetCache, invalidateCache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    // 1. Rate Limiting: 120 requests per minute
    const rateCheck = await checkRateLimit(req, 'api_stats', { limit: 120, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    // 2. Authentication Check
    const authCheck = requireAuth(req);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;
    const forceRefresh = searchParams.get('forceRefresh') === 'true' || searchParams.get('refresh') === 'true';

    const cacheKey = `dashboard_stats_${eventId || 'all'}`;

    if (forceRefresh) {
      invalidateCache(cacheKey);
    }

    // 3. Cached DB Fetch (60 seconds TTL)
    const { data: stats, isCached, ageSeconds } = await getOrSetCache(
      cacheKey,
      () => getDashboardStats(eventId),
      60 // 60 seconds TTL
    );

    const usingSupabase = isUsingSupabase();
    const settings = getSettings();

    return NextResponse.json({
      success: true,
      stats,
      isCached,
      cacheAgeSeconds: ageSeconds,
      isSupabase: usingSupabase,
      settings: {
        storageMode: settings.storageMode,
        googleSheetsMode: settings.googleSheetsMode,
        googleSpreadsheetId: settings.googleSpreadsheetId || '',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
