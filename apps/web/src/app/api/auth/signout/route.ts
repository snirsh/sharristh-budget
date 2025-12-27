import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@sfam/db';

/**
 * POST /api/auth/signout
 * Sign out the current user by deleting their session
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('authjs.session-token')?.value;

    if (sessionToken) {
      // Delete session from database
      await prisma.session.delete({
        where: { sessionToken },
      }).catch(() => {
        // Session might already be deleted
      });

      // Clear the session cookie
      cookieStore.delete('authjs.session-token');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json({ success: true }); // Still succeed to clear client state
  }
}

