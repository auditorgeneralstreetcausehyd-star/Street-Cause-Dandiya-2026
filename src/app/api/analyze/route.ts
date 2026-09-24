import { NextRequest, NextResponse } from 'next/server';
import { analyzeExcelBuffer } from '@/lib/excelProcessor';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = (formData.get('eventId') as string) || 'garba_groove';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const analysis = await analyzeExcelBuffer(buffer, file.name, eventId);

    return NextResponse.json({ success: true, analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error analyzing excel file:', msg);
    return NextResponse.json({ error: `Failed to analyze file: ${msg}` }, { status: 500 });
  }
}

