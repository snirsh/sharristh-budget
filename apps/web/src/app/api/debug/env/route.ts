import { NextResponse } from 'next/server';

/**
 * GET /api/debug/env
 * Debug endpoint to check environment variables (DO NOT USE IN REAL PRODUCTION!)
 */
export async function GET() {
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: !!process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    authSecretLength: process.env.AUTH_SECRET?.length || 0,
    authSecretPreview: process.env.AUTH_SECRET?.substring(0, 10) + '...',
    AUTH_WEBAUTHN_RP_ID: process.env.AUTH_WEBAUTHN_RP_ID || 'NOT SET',
    AUTH_WEBAUTHN_RP_ORIGIN: process.env.AUTH_WEBAUTHN_RP_ORIGIN || 'NOT SET',
    AUTH_WEBAUTHN_RP_NAME: process.env.AUTH_WEBAUTHN_RP_NAME || 'NOT SET',
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPreview: process.env.DATABASE_URL?.substring(0, 20) + '...',
  });
}
