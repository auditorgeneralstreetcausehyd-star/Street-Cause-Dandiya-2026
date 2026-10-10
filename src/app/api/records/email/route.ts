import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { updatePassEmail } from '@/lib/db';
import { normalizeEmail, isValidEmail } from '@/lib/emailAddress';
import { invalidateCache } from '@/lib/cache';

// Correct a pass holder's email (e.g. after a bounce). The pass is reset to Pending; the client then resends it.
export async function POST(request: NextRequest) {
  try {
    const rateCheck = await checkRateLimit(request, 'api_update_email', { limit: 60, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    const authCheck = requireAuth(request);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const body = await request.json();
    const orderId = String(body.orderId || '').trim();
    const email = normalizeEmail(body.email);

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: `Invalid email address: ${body.email}` }, { status: 400 });
    }

    const record = await updatePassEmail(orderId, email);
    if (!record) {
      return NextResponse.json({ success: false, error: `No pass found for ${orderId}` }, { status: 404 });
    }
    invalidateCache('records_');

    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update email';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
