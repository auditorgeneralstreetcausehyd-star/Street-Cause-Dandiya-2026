import { NextResponse } from 'next/server';
import { getRecordsByOrderIds, updateRecordEmailStatus } from '@/lib/db';
import { sendBulkPassEmails } from '@/lib/emailService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderIds, eventId } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No orderIds provided' }, { status: 400 });
    }

    // 1. Fetch matching records
    const records = await getRecordsByOrderIds(orderIds);
    
    // Filter to only PASS records for the specific event (if eventId is provided and not 'all')
    const passRecords = records.filter(r => 
      r.record_type === 'PASS' && 
      (!eventId || eventId === 'all' || r.event_id === eventId)
    );

    if (passRecords.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching PASS records found for the given IDs.' }, { status: 404 });
    }

    // 2. Send emails
    const results = await sendBulkPassEmails(passRecords);

    // 3. Update database status
    let sentCount = 0;
    let failedCount = 0;
    const now = new Date().toISOString();

    for (const res of results) {
      if (res.status === 'Sent') {
        sentCount++;
        await updateRecordEmailStatus(res.orderId, 'Sent', now);
      } else {
        failedCount++;
        await updateRecordEmailStatus(res.orderId, 'Failed', null);
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      results
    });

  } catch (error: any) {
    console.error('Email API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
