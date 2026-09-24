import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats, getSettings, isUsingSupabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;

    const stats = await getDashboardStats(eventId);
    const usingSupabase = isUsingSupabase();
    const settings = getSettings();

    return NextResponse.json({
      success: true,
      stats,
      isSupabase: usingSupabase,
      settings: {
        storageMode: settings.storageMode,
        googleSheetsMode: settings.googleSheetsMode,
        googleSpreadsheetId: settings.googleSpreadsheetId || '',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

