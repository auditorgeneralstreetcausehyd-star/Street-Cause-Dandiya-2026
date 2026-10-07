import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSenderQuota } from '@/lib/emailWorker';

// Per-account sends in the rolling 24h window, for the dashboard's capacity indicator
export async function GET(request: NextRequest) {
  const authCheck = requireAuth(request);
  if (!authCheck.authenticated && authCheck.response) {
    return authCheck.response;
  }

  try {
    const quota = await getSenderQuota();
    return NextResponse.json({ success: true, ...quota });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to read sender quota';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
