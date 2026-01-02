/**
 * Registration layout - simplified
 * Actual registration access control is handled by the page and API endpoints
 * This allows for proper invite code validation from URL parameters
 */
export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic';
