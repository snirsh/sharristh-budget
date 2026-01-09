'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

/**
 * Client-side WebAuthn registration flow
 * @param email - User email to register
 * @param inviteCode - One-time invite code for registration
 */
export async function registerPasskey(email: string, inviteCode: string) {
  // Step 1: Get registration options from server
  const optionsRes = await fetch('/api/auth/webauthn/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, inviteCode }),
  });

  if (!optionsRes.ok) {
    const error = await optionsRes.json();
    throw new Error(error.error || 'Failed to get registration options');
  }

  const options: PublicKeyCredentialCreationOptionsJSON = await optionsRes.json();

  // Step 2: Start WebAuthn registration ceremony (browser + authenticator)
  const credential = await startRegistration(options);

  // Step 3: Verify registration with server
  const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      inviteCode,
      credential,
    }),
  });

  if (!verifyRes.ok) {
    const error = await verifyRes.json();
    throw new Error(error.error || 'Failed to verify registration');
  }

  return verifyRes.json();
}

/**
 * Client-side WebAuthn authentication flow
 */
export async function authenticatePasskey() {
  // Step 1: Get authentication options from server
  const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!optionsRes.ok) {
    const error = await optionsRes.json();
    throw new Error(error.error || 'Failed to get authentication options');
  }

  const optionsData = await optionsRes.json();
  const { sessionId, ...options } = optionsData as PublicKeyCredentialRequestOptionsJSON & {
    sessionId: string;
  };

  // Step 2: Start WebAuthn authentication ceremony
  const credential = await startAuthentication(options);

  // Step 3: Verify authentication with server
  const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, sessionId }),
  });

  if (!verifyRes.ok) {
    const error = await verifyRes.json();
    throw new Error(error.error || 'Authentication failed');
  }

  return verifyRes.json();
}

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

/**
 * Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
