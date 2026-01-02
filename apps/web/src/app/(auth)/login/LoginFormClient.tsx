'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Fingerprint, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { authenticatePasskey, isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '@/lib/auth-client';

export default function LoginFormClient() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const message = searchParams.get('message');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const info = message === 'registration_closed' ? 'Registration is closed. This app only allows one user.' : null;

  useEffect(() => {
    // Check WebAuthn support
    async function checkSupport() {
      if (!isWebAuthnSupported()) {
        setIsSupported(false);
        return;
      }
      const platformAvailable = await isPlatformAuthenticatorAvailable();
      setIsSupported(platformAvailable);
    }
    checkSupport();
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authenticatePasskey();
      // Success - use full page reload to ensure session cookie is recognized
      // Client-side navigation (router.push) doesn't pick up the newly set cookie
      window.location.href = callbackUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* WebAuthn Support Check */}
      {isSupported === false && (
        <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-200 text-sm font-medium">
                Passkeys not supported
              </p>
              <p className="text-amber-200/70 text-xs mt-1">
                Your browser or device doesn&apos;t support passkeys. Please use a modern browser with biometric authentication.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Message */}
      {info && (
        <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-blue-200 text-sm">{info}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Login Button */}
      <button
        onClick={handleLogin}
        disabled={isLoading || isSupported === false}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/40 disabled:shadow-none"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <Fingerprint className="w-5 h-5" />
            <span>Sign in with Passkey</span>
          </>
        )}
      </button>

      {/* Info */}
      <div className="mt-6 text-center">
        <p className="text-slate-400 text-sm">
          Use Face ID, Touch ID, or Windows Hello to sign in securely.
        </p>
      </div>

      {/* Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-transparent text-slate-500">
            New here?
          </span>
        </div>
      </div>

      {/* Register Link - Hide if registration is closed */}
      {!info && (
        <Link
          href="/register"
          className="block w-full text-center px-6 py-3 border border-white/20 text-white/80 hover:text-white hover:border-white/40 font-medium rounded-xl transition-all duration-200"
        >
          Register with invite code
        </Link>
      )}
    </>
  );
}
