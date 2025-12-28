import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@sfam/db';
import { getAndRemoveChallenge, hashInviteCode, getRPConfig } from '@/lib/webauthn-utils';

/**
 * POST /api/auth/webauthn/register/verify
 * Verify WebAuthn registration and create user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, inviteCode, credential } = body as {
      email: string;
      inviteCode: string;
      credential: RegistrationResponseJSON;
    };

    if (!email || !inviteCode || !credential) {
      return NextResponse.json(
        { error: 'Email, invite code, and credential are required' },
        { status: 400 }
      );
    }

    // Get stored challenge
    const expectedChallenge = await getAndRemoveChallenge(`register_${email}`);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Registration session expired. Please try again.' },
        { status: 400 }
      );
    }

    // Re-verify invite code (only database-stored codes are valid)
    const hashedCode = hashInviteCode(inviteCode);
    const storedInvite = await prisma.inviteCode.findUnique({
      where: { code: hashedCode },
    });

    if (!storedInvite) {
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

    // Get RP configuration
    const { rpID, origin } = getRPConfig();

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      );
    }

    const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Create user and authenticator in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create or get user
      let user = await tx.user.findUnique({ where: { email } });
      
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            name: email.split('@')[0] || email,
            emailVerified: new Date(), // Verified via invite code
          },
        });

        // Create default household for single-user setup
        const household = await tx.household.create({
          data: {
            name: `${user.name}'s Household`,
          },
        });

        // Add user as household owner
        await tx.householdMember.create({
          data: {
            householdId: household.id,
            userId: user.id,
            role: 'owner',
          },
        });
      }

      // Store authenticator
      const authenticator = await tx.authenticator.create({
        data: {
          credentialID: Buffer.from(credentialID).toString('base64url'),
          userId: user.id,
          credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
          counter: BigInt(counter),
          credentialDeviceType,
          credentialBackedUp,
          transports: credential.response.transports?.join(','),
        },
      });

      // Mark invite code as used (if it's a stored one, not the admin env var)
      if (storedInvite) {
        await tx.inviteCode.update({
          where: { id: storedInvite.id },
          data: {
            usedAt: new Date(),
            usedByUserId: user.id,
          },
        });
      }

      return { user, authenticator };
    });

    return NextResponse.json({
      success: true,
      message: 'Passkey registered successfully. You can now sign in.',
      userId: result.user.id,
    });
  } catch (error) {
    console.error('Registration verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify registration' },
      { status: 500 }
    );
  }
}

