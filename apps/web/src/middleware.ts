import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight middleware for Edge runtime
 * - Checks for session cookie presence (fast, edge-compatible)
 * - Actual session validation happens in server components and API routes
 * - Login page validates sessions server-side and redirects if already authenticated
 * - Protected pages validate sessions via auth() calls
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Skip auth check in demo mode
  if (process.env.DEMO_MODE === 'true') {
    return NextResponse.next();
  }

  // Check for session cookie (lightweight check for Edge runtime)
  // Auth.js uses different cookie names based on environment
  const sessionCookie =
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('__Secure-authjs.session-token');

  // If no session cookie, redirect to login
  // Session validity (expiration) is validated by:
  // - Server components (e.g., login page checks and redirects if authenticated)
  // - API routes (validate session on each request)
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists - allow request
  // Individual routes will validate session validity as needed
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



