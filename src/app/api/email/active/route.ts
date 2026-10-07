import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getActiveEmailBatches } from '@/lib/db';

// Read-only list of email batches still sending, so the dashboard can show progress for any batch,
// including ones started from another tab or a script. Unlike /api/email/status it never drives the worker.
export async function GET(request: NextRequest) {
  const authCheck = requireAuth(request);
  if (!authCheck.authenticated && authCheck.response) {
    return authCheck.response;
  }

  try {
    const batches = await getActiveEmailBatches();
    return NextResponse.json({ success: true, batches });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to read active batches';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
