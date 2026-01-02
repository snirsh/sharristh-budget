import { Suspense } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginFormClient from './LoginFormClient';

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Check if user is already authenticated
  const session = await auth();

  if (session?.user) {
    // User is already logged in, redirect to callback URL or home
    const params = await searchParams;
    const callbackUrl = params.callbackUrl || '/';
    redirect(callbackUrl);
  }

  return (
    <div className="space-y-8">
      {/* Logo/Brand */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Sharristh Budget
        </h1>
        <p className="mt-2 text-slate-400">
          Sign in with your passkey
        </p>
      </div>

      {/* Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10">
        <Suspense fallback={<LoginFormFallback />}>
          <LoginFormClient />
        </Suspense>
      </div>

      {/* Footer */}
      <p className="text-center text-slate-500 text-xs">
        Secured with WebAuthn • No passwords stored
      </p>
    </div>
  );
}
