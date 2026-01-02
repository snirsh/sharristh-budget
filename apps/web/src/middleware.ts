import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Public routes that don't require authentication
 */
const publicRoutes = [
  '/login',
  '/register',
  '/api/auth',
];

/**
 * Check if a path matches any public route
 */
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route));
}

/**
 * Middleware to protect routes
 * Redirects unauthenticated users to login
 * Validates session expiration
 * Skips auth in demo mode
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Skip auth check in demo mode
  if (process.env.DEMO_MODE === 'true') {
    return NextResponse.next();
  }

  // Validate session using Auth.js
  // This checks both cookie existence and session validity (including expiration)
  const session = await auth();

  // If no valid session, redirect to login
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Valid session exists, allow request
  return NextResponse.next();
}

/**
 * Configure middleware to run on specific paths
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};



