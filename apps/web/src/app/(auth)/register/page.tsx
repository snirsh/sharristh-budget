'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail, Shield, Loader2, AlertCircle, CheckCircle, Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { registerPasskey, isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '@/lib/auth-client';

type Step = 'form' | 'registering' | 'success';

export default function RegisterPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      setStep('registering');
      await registerPasskey(email, inviteCode);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="space-y-8">
      {/* Logo/Brand */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-violet-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Create Account
        </h1>
        <p className="mt-2 text-slate-400">
          {step === 'success' 
            ? 'Your passkey has been registered!' 
            : 'Set up your passkey with an invite code'}
        </p>
      </div>

      {/* Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10">
        {/* Success State */}
        {step === 'success' && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Registration Complete!
              </h2>
              <p className="text-slate-400 text-sm">
                Your passkey has been saved. You can now sign in using your biometrics.
              </p>
            </div>
            <button
              onClick={handleGoToLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/30"
            >
              <Fingerprint className="w-5 h-5" />
              <span>Continue to Sign In</span>
            </button>
          </div>
        )}

        {/* Registering State */}
        {step === 'registering' && (
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto w-20 h-20 bg-violet-500/20 rounded-full flex items-center justify-center animate-pulse">
              <Fingerprint className="w-10 h-10 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Complete Registration
              </h2>
              <p className="text-slate-400 text-sm">
                Follow your device&apos;s prompts to set up your passkey with Face ID, Touch ID, or Windows Hello.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Waiting for biometric verification...</span>
            </div>
          </div>
        )}

        {/* Form State */}
        {step === 'form' && (
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

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Invite Code Field */}
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-slate-300 mb-2">
                  Invite code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                    placeholder="Enter your invite code"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all font-mono"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  You need an invite code to register. Contact the administrator for access.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isSupported === false || !email || !inviteCode}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-violet-500 hover:bg-violet-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/30 hover:shadow-violet-400/40 disabled:shadow-none mt-8"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5" />
                    <span>Register Passkey</span>
                  </>
                )}
              </button>
            </form>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                What is a passkey?
              </h3>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>• Replaces passwords with biometric authentication</li>
                <li>• Uses Face ID, Touch ID, or Windows Hello</li>
                <li>• Phishing-resistant and more secure than passwords</li>
                <li>• Your private key never leaves your device</li>
              </ul>
            </div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-slate-500">
                  Already have an account?
                </span>
              </div>
            </div>

            {/* Login Link */}
            <Link
              href="/login"
              className="block w-full text-center px-6 py-3 border border-white/20 text-white/80 hover:text-white hover:border-white/40 font-medium rounded-xl transition-all duration-200"
            >
              Sign in with passkey
            </Link>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-slate-500 text-xs">
        Secured with WebAuthn • Your keys stay on your device
      </p>
    </div>
  );
}



