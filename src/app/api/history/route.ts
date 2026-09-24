import { NextRequest, NextResponse } from 'next/server';
import { getImportBatches } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;

    const batches = await getImportBatches(eventId);
    return NextResponse.json({ success: true, batches });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

