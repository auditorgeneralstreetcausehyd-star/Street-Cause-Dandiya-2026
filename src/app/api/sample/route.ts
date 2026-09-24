import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const sampleFilePath = path.join(process.cwd(), 'payment_links - 17 Sep 26 (3).xlsx');

    if (!fs.existsSync(sampleFilePath)) {
      return NextResponse.json({ error: 'Sample file not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(sampleFilePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Sample_Dandiya_Payments.xlsx"',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
