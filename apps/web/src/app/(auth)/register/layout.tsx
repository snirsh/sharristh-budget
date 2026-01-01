import { prisma } from '@sfam/db';
import { redirect } from 'next/navigation';

/**
 * Registration layout - checks if registration is allowed
 * Single-user system - only allow one user
 */
export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Skip check during build (no DATABASE_URL available)
  if (!process.env.DATABASE_URL) {
    return <>{children}</>;
  }

  // Check if any users exist
  const userCount = await prisma.user.count();

  // If a user already exists, redirect to login
  if (userCount > 0) {
    redirect('/login?message=registration_closed');
  }

  return <>{children}</>;
}

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic';
