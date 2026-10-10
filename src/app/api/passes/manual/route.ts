import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { createManualPass } from '@/lib/db';
import { normalizeEmail, isValidEmail } from '@/lib/emailAddress';
import { invalidateCache } from '@/lib/cache';

// Create a pass entered by an admin (offline sale / guest). The client then sends it through /api/email.
export async function POST(request: NextRequest) {
  try {
    const rateCheck = await checkRateLimit(request, 'api_manual_pass', { limit: 30, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    const authCheck = requireAuth(request);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const body = await request.json();
    const eventId = body.eventId;
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(body.email);
    const phone = String(body.phone || '').replace(/[^\d+]/g, '');
    const quantity = Number(body.quantity);
    const amount = body.amount === '' || body.amount === undefined || body.amount === null ? 0 : Number(body.amount);

    if (eventId !== 'garba_groove' && eventId !== 'navratri_utsav') {
      return NextResponse.json({ success: false, error: 'Select an event.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required.' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: `Invalid email address: ${body.email}` }, { status: 400 });
    }
    if (phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Enter a valid mobile number (at least 10 digits).' }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return NextResponse.json({ success: false, error: 'Number of passes must be a whole number from 1 to 50.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ success: false, error: 'Amount must be 0 or more.' }, { status: 400 });
    }

    const record = await createManualPass({
      eventId,
      name,
      email,
      phone,
      quantity,
      amount,
      createdBy: authCheck.session?.email,
    });
    invalidateCache('records_');

    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create pass';
    console.error('Manual pass error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
