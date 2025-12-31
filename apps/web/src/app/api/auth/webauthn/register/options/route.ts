import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@sfam/db';
import { storeChallenge, hashInviteCode, getRPConfig } from '@/lib/webauthn-utils';

/**
 * GET /api/auth/webauthn/register/options
 * Return method not allowed for GET requests
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to get registration options.' },
    { status: 405, headers: { 'Allow': 'POST' } }
  );
}

/**
 * POST /api/auth/webauthn/register/options
 * Get WebAuthn registration options for a new user
 */
export async function POST(request: NextRequest) {
  console.log('[WebAuthn] POST /api/auth/webauthn/register/options called');
  console.log('[WebAuthn] Environment check:', {
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasRpId: !!process.env.AUTH_WEBAUTHN_RP_ID,
    hasRpOrigin: !!process.env.AUTH_WEBAUTHN_RP_ORIGIN,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  });

  try {
    const body = await request.json();
    const { email, inviteCode } = body;
    console.log('[WebAuthn] Request body parsed:', { email, hasInviteCode: !!inviteCode });

    if (!email || !inviteCode) {
      return NextResponse.json(
        { error: 'Email and invite code are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Verify invite code (only database-stored codes are valid)
    const hashedCode = hashInviteCode(inviteCode);
    console.log('[WebAuthn Options] Checking invite code:', {
      hashedCode,
      inviteCode: inviteCode.substring(0, 4) + '...',
    });

    const storedInvite = await prisma.inviteCode.findUnique({
      where: { code: hashedCode },
    });

    console.log('[WebAuthn Options] Invite code lookup result:', {
      found: !!storedInvite,
      usedAt: storedInvite?.usedAt,
    });

    if (!storedInvite) {
      console.log('[WebAuthn Options] Invite code not found in database');
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 403 }
      );
    }

    if (storedInvite?.usedAt) {
      return NextResponse.json(
        { error: 'Invite code has already been used' },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Check if they already have authenticators
      const existingAuthenticators = await prisma.authenticator.findMany({
        where: { userId: existingUser.id },
      });

      if (existingAuthenticators.length > 0) {
        return NextResponse.json(
          { error: 'User already has a passkey registered' },
          { status: 409 }
        );
      }
    }

    // Get RP configuration
    const { rpID, rpName } = getRPConfig();

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: email, // Use email as user identifier
      userName: email,
      userDisplayName: email.split('@')[0],
      attestationType: 'none', // Don't require attestation for simplicity
      authenticatorSelection: {
        // Prefer platform authenticators (Touch ID, Face ID, Windows Hello)
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000, // 60 seconds
    });

    // Store challenge for verification (key: register_<email>)
    await storeChallenge(`register_${email}`, options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error('Registration options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
