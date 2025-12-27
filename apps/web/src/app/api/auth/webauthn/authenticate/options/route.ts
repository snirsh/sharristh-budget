import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@sfam/db';
import { storeChallenge, getRPConfig } from '@/lib/webauthn-utils';
import crypto from 'crypto';

/**
 * POST /api/auth/webauthn/authenticate/options
 * Get WebAuthn authentication options
 */
export async function POST() {
  try {
    // Get all authenticators (for discoverable credentials)
    // In a multi-user system, you might filter by email first
    const authenticators = await prisma.authenticator.findMany({
      select: {
        credentialID: true,
        transports: true,
      },
    });

    if (authenticators.length === 0) {
      return NextResponse.json(
        { error: 'No registered passkeys found. Please register first.' },
        { status: 404 }
      );
    }

    // Get RP configuration
    const { rpID } = getRPConfig();

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID,
      // Allow any registered credential (discoverable credential flow)
      allowCredentials: authenticators.map((auth) => ({
        id: Buffer.from(auth.credentialID, 'base64url'),
        type: 'public-key',
        transports: auth.transports?.split(',') as AuthenticatorTransport[] | undefined,
      })),
      userVerification: 'required',
      timeout: 60000,
    });

    // Store challenge with a random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    await storeChallenge(`auth_${sessionId}`, options.challenge);

    // Return options with session ID for verification
    return NextResponse.json({
      ...options,
      sessionId, // Client needs to send this back for verification
    });
  } catch (error) {
    console.error('Authentication options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}

