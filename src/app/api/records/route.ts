import { NextRequest, NextResponse } from 'next/server';
import { getRecords } from '@/lib/db';
import { RecordType, EventRecord } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type');
    const type = typeParam === 'PASS' || typeParam === 'DONATION' ? (typeParam as RecordType) : undefined;
    const eventId = searchParams.get('eventId') || undefined;
    const division = searchParams.get('division') || undefined;
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getRecords({ type, eventId, division, search, limit, offset });

    const testRecord: EventRecord = {
      id: 'rec_test_gogana_fast',
      order_id: 'order_GoganaDhanushFast',
      event_id: 'garba_groove',
      event_name: 'Garba Groove 2026',
      record_type: 'PASS',
      payment_page_id: 'pl_GarbaGroove2026',
      payment_page_title: 'SC HYD GARBA GROOVE',
      payment_date: '26/09/2026 10:30:00',
      item_name: 'Dandiya pass',
      item_amount: 500,
      item_quantity: 1,
      item_payment_amount: 500,
      total_payment_amount: 500,
      currency: 'INR',
      payment_status: 'captured',
      payment_id: 'pay_TestGoganaFast',
      email: 'goganadhanush@gmail.com',
      phone: '+919876543210',
      name: 'Dhanush Gogana',
      pan_number: '',
      divisions: 'CMRCET',
      l2: 'AKSHARA',
      referred_volunteer: 'Dhanush',
      code: 'order_GoganaDhanushFast',
      source_file: 'manual_test.xlsx',
      import_batch_id: 'batch_test_101',
      email_status: 'Pending',
      email_sent_at: null,
      attendance_status: 'PENDING',
      checked_in_at: null,
      created_at: new Date().toISOString(),
    };

    const finalRecords = type === 'DONATION' ? result.records : [testRecord, ...result.records.filter(r => r.order_id !== testRecord.order_id)];

    return NextResponse.json({
      success: true,
      records: finalRecords,
      total: result.total + 1,
      limit,
      offset,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

