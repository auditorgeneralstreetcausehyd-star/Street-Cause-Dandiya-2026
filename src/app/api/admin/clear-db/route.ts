import { NextResponse } from 'next/server';
import { clearDatabase } from '@/lib/db';

export async function POST() {
  try {
    const result = await clearDatabase();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear database';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await clearDatabase();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear database';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
