import { NextResponse } from 'next/server';
import { insertEventRecords } from '@/lib/db';
import { EventRecord } from '@/lib/types';

export async function GET() {
  try {
    const timestamp = Date.now();
    const testRecord: EventRecord = {
      id: `rec_gogana_${timestamp}`,
      order_id: `order_DhanushGogana_${timestamp.toString().slice(-4)}`,
      event_id: 'garba_groove',
      event_name: 'Garba Groove 2026',
      record_type: 'PASS',
      payment_page_id: 'pl_GarbaGroove2026',
      payment_page_title: 'SC HYD GARBA GROOVE',
      payment_date: new Date().toISOString(),
      item_name: 'Dandiya pass',
      item_amount: 500,
      item_quantity: 1,
      item_payment_amount: 500,
      total_payment_amount: 500,
      currency: 'INR',
      payment_status: 'captured',
      payment_id: `pay_DhanushGogana_${timestamp}`,
      email: 'goganadhanush@gmail.com',
      phone: '+919876543210',
      name: 'Dhanush Gogana',
      pan_number: '',
      divisions: 'CMRCET',
      l2: 'AKSHARA',
      referred_volunteer: 'Dhanush',
      code: `SC-GARBA-${timestamp.toString().slice(-4)}`,
      source_file: 'manual_test.xlsx',
      import_batch_id: 'batch_test_101',
      email_status: 'Pending',
      email_sent_at: null,
      attendance_status: 'PENDING',
      checked_in_at: null,
      created_at: new Date().toISOString(),
    };

    const res = await insertEventRecords([testRecord]);
    return NextResponse.json({ success: true, message: 'Test record created!', inserted: res.inserted, record: testRecord });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
