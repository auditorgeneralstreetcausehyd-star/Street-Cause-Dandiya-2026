import { NextRequest, NextResponse } from 'next/server';
import { clearDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { invalidateCache } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const rateCheck = await checkRateLimit(req, 'api_admin_clear', { limit: 5, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    const authCheck = requireAuth(req);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const result = await clearDatabase();
    invalidateCache(); // Clear all cache entries
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear database';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
