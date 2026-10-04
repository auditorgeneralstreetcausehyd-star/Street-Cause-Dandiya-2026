import { NextRequest, NextResponse } from 'next/server';
import { getRecordsByOrderIds } from '@/lib/db';
import { generatePassEmailHTML } from '@/lib/emailService';
import { requireAuth } from '@/lib/auth';
import { EventRecord } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAuth(request);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const eventId = searchParams.get('eventId') || 'garba_groove';

    let record: EventRecord;

    if (orderId) {
      const records = await getRecordsByOrderIds([orderId]);
      if (records.length > 0) {
        record = records[0];
      } else {
        return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
      }
    } else {
      // Sample record for previewing template
      record = {
        id: 'sample_preview',
        order_id: 'order_SAMPLE12345',
        code: 'order_SAMPLE12345',
        event_id: eventId as 'garba_groove' | 'navratri_utsav',
        event_name: eventId === 'navratri_utsav' ? 'Navratri Utsav 2026' : 'Garba Groove 2026',
        record_type: 'PASS',
        item_name: 'Regular Single Pass',
        item_amount: 399,
        item_quantity: 1,
        item_payment_amount: 399,
        total_payment_amount: 399,
        currency: 'INR',
        payment_status: 'captured',
        email: 'attendee.preview@example.com',
        phone: '9876543210',
        name: 'Sample Attendee',
        divisions: 'VNRVJIET',
        l2: 'John Doe',
        source_file: 'preview',
        import_batch_id: 'preview',
        email_status: 'Pending',
        created_at: new Date().toISOString(),
      };
    }

    const html = generatePassEmailHTML(record);
    return NextResponse.json({ success: true, html, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
