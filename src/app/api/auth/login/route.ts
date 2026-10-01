import { NextRequest, NextResponse } from 'next/server';
import { AUTH_EMAIL, AUTH_PASSWORD, createSessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    // Rate limit login attempts: 10 attempts per minute per IP
    const rateCheck = checkRateLimit(req, 'auth_login', { limit: 10, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const expectedEmail = AUTH_EMAIL.toLowerCase();

    if (trimmedEmail !== expectedEmail || password !== AUTH_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please try again.' },
        { status: 401 }
      );
    }

    // Generate session token (valid for 72 hours)
    const token = createSessionToken(trimmedEmail, 72);

    const res = NextResponse.json({
      success: true,
      user: {
        email: trimmedEmail,
        role: 'admin',
      },
      token,
    });

    // Set secure HTTP-only cookie
    res.cookies.set('sc_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 72 * 60 * 60, // 3 days
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
