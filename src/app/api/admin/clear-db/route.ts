import { NextResponse } from 'next/server';
import { clearDatabase } from '@/lib/db';

export async function POST() {
  try {
    const result = await clearDatabase();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clear database' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await clearDatabase();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clear database' },
      { status: 500 }
    );
  }
}
