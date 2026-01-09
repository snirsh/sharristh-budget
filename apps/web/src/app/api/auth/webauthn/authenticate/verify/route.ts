import crypto from 'crypto';
import { getAndRemoveChallenge, getRPConfig } from '@/lib/webauthn-utils';
import { prisma } from '@sfam/db';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/webauthn/authenticate/verify
 * Verify WebAuthn authentication and create session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential, sessionId } = body as {
      credential: AuthenticationResponseJSON;
      sessionId: string;
    };

    if (!credential || !sessionId) {
      return NextResponse.json(
        { error: 'Credential and session ID are required' },
        { status: 400 }
      );
    }

    // Get stored challenge
    const expectedChallenge = await getAndRemoveChallenge(`auth_${sessionId}`);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Authentication session expired. Please try again.' },
        { status: 400 }
      );
    }

    // Find the authenticator
    const credentialID = credential.id;
    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialID },
      include: { user: true },
    });

    if (!authenticator) {
      return NextResponse.json(
        { error: 'Unknown passkey. Please register first.' },
        { status: 404 }
      );
    }

    // Get RP configuration
    const { rpID, origin } = getRPConfig();

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(authenticator.credentialID, 'base64url'),
        credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
        counter: Number(authenticator.counter),
        transports: authenticator.transports?.split(',') as AuthenticatorTransport[] | undefined,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication verification failed' }, { status: 400 });
    }

    // Update authenticator counter
    await prisma.authenticator.update({
      where: { credentialID },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        sessionToken,
        userId: authenticator.userId,
        expires,
      },
    });

    // Set session cookie
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token';

    console.log('[WebAuthn Authenticate] Setting session cookie:', {
      cookieName,
      isProduction,
      userId: authenticator.userId,
      expires,
    });

    cookieStore.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      expires,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authenticator.user.id,
        email: authenticator.user.email,
        name: authenticator.user.name,
      },
    });
  } catch (error) {
    console.error('Authentication verification error:', error);
    return NextResponse.json({ error: 'Failed to verify authentication' }, { status: 500 });
  }
}
