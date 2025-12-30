import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
 * Skips auth in demo mode
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Skip auth check in demo mode
  if (process.env.DEMO_MODE === 'true') {
    return NextResponse.next();
  }

  // Check for session cookie
  // Auth.js uses different cookie names based on environment
  const sessionCookie =
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('__Secure-authjs.session-token');

  // If no session, redirect to login
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists, allow request
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



