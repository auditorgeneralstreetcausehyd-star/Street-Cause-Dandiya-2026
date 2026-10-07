import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, testSupabaseConnection } from '@/lib/db';
import { testGoogleSheetsConnection } from '@/lib/googleSheets';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  // Authentication check
  const authCheck = requireAuth(req);
  if (!authCheck.authenticated && authCheck.response) {
    return authCheck.response;
  }

  const settings = getSettings();
  // Mask sensitive keys for safety
  const safeSettings = {
    ...settings,
    supabaseServiceKey: settings.supabaseServiceKey ? '••••••••' : '',
    googlePrivateKey: settings.googlePrivateKey ? '••••••••' : '',
  };
  return NextResponse.json({ success: true, settings: safeSettings });
}

export async function POST(req: NextRequest) {
  try {
    const rateCheck = await checkRateLimit(req, 'api_settings_post', { limit: 30, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    const authCheck = requireAuth(req);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const body = await req.json();
    const action = body.action;

    if (action === 'test-supabase') {
      const { url, key } = body;
      const res = await testSupabaseConnection(url, key);
      return NextResponse.json(res);
    }

    if (action === 'test-sheets') {
      const { spreadsheetId, email, key } = body;
      const res = await testGoogleSheetsConnection(spreadsheetId, email, key);
      return NextResponse.json(res);
    }

    // Save settings
    const updated = saveSettings(body.settings || {});
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
