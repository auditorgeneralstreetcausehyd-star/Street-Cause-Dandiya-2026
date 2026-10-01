import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const AUTH_EMAIL = process.env.ADMIN_EMAIL || 'auditorgeneral.streetcausehyd@gmail.com';
export const AUTH_PASSWORD = process.env.ADMIN_PASSWORD || 'SCHYD2627';
const JWT_SECRET = process.env.AUTH_SECRET || 'sc-dandiya-2026-super-secret-key-schyd';

export interface AuthSession {
  email: string;
  role: 'admin';
  exp: number;
}

/**
 * Generate a signed session token (HMAC-SHA256)
 */
export function createSessionToken(email: string, durationHours = 72): string {
  const payload: AuthSession = {
    email,
    role: 'admin',
    exp: Date.now() + durationHours * 60 * 60 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a signed session token
 */
export function verifySessionToken(token?: string | null): AuthSession | null {
  if (!token || !token.includes('.')) return null;
  try {
    const [payloadB64, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
    if (signature !== expectedSig) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AuthSession;
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and authenticate request from cookies or Authorization header
 */
export function authenticateRequest(req: NextRequest): AuthSession | null {
  // Check Authorization Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const session = verifySessionToken(token);
    if (session) return session;
  }

  // Check custom header x-admin-token
  const customHeader = req.headers.get('x-admin-token');
  if (customHeader) {
    const session = verifySessionToken(customHeader);
    if (session) return session;
  }

  // Check session cookie
  const cookieToken = req.cookies.get('sc_admin_session')?.value;
  if (cookieToken) {
    const session = verifySessionToken(cookieToken);
    if (session) return session;
  }

  return null;
}

/**
 * Helper to require authentication on API route
 */
export function requireAuth(req: NextRequest): { authenticated: boolean; session?: AuthSession; response?: NextResponse } {
  const session = authenticateRequest(req);
  if (!session) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required to access this resource.' },
        { status: 401 }
      ),
    };
  }
  return { authenticated: true, session };
}
