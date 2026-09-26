import { NextRequest, NextResponse } from 'next/server';
import { getRecordByCode, updateAttendanceStatus } from '@/lib/db';

const ADMIN_PASSCODE = process.env.ADMIN_VERIFY_PASSCODE || process.env.ADMIN_PASSCODE || 'admin123';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const passcode = request.headers.get('x-admin-passcode') || searchParams.get('passcode');

    if (!code || !code.trim()) {
      return NextResponse.json({ success: false, error: 'Pass code or Order ID is required' }, { status: 400 });
    }

    // Check Admin Passcode Authorization
    if (passcode !== ADMIN_PASSCODE) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid Admin Passcode', isAuthError: true }, { status: 401 });
    }

    const record = await getRecordByCode(code.trim());
    if (!record) {
      return NextResponse.json({ success: false, error: `No pass record found for code: ${code}` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        order_id: record.order_id,
        code: record.code || record.order_id,
        name: record.name || 'Valued Guest',
        email: record.email || 'N/A',
        phone: record.phone || 'N/A',
        item_name: record.item_name || 'Event Pass',
        item_quantity: record.item_quantity || 1,
        item_payment_amount: record.item_payment_amount || record.item_amount || 0,
        payment_status: record.payment_status || 'Paid',
        divisions: record.divisions || 'N/A',
        l2: record.l2 || 'N/A',
        attendance_status: record.attendance_status || 'PENDING',
        checked_in_at: record.checked_in_at || null,
        created_at: record.created_at,
      },
    });
  } catch (err: any) {
    console.error('Verify API GET error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, status, passcode } = body;

    const authPasscode = passcode || request.headers.get('x-admin-passcode');

    if (authPasscode !== ADMIN_PASSCODE) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid Admin Passcode', isAuthError: true }, { status: 401 });
    }

    if (!code || !status || !['PRESENT', 'CANCELLED', 'PENDING'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters provided' }, { status: 400 });
    }

    const result = await updateAttendanceStatus(code, status);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to update attendance' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Pass status updated to ${status} successfully!`,
      record: result.record,
    });
  } catch (err: any) {
    console.error('Verify API POST error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
