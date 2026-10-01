import { NextRequest, NextResponse } from 'next/server';
import { processAndImportExcel } from '@/lib/excelProcessor';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { invalidateCache } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting: 10 per minute
    const rateCheck = checkRateLimit(req, 'api_import', { limit: 10, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    // 2. Authentication
    const authCheck = requireAuth(req);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = (formData.get('eventId') as string) || 'garba_groove';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processAndImportExcel(buffer, file.name, eventId);

    // Invalidate cache immediately on new import so dashboard shows fresh imported data
    invalidateCache();

    return NextResponse.json({
      success: true,
      batch: result.batch,
      syncResult: result.syncResult,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error importing excel file:', msg);
    return NextResponse.json({ error: `Failed to import file: ${msg}` }, { status: 500 });
  }
}
