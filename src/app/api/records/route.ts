import { NextRequest, NextResponse } from 'next/server';
import { getRecords } from '@/lib/db';
import { RecordType } from '@/lib/types';

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

    return NextResponse.json({
      success: true,
      records: result.records,
      total: result.total,
      limit,
      offset,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

