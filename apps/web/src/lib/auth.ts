import NextAuth, { type NextAuthResult } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Passkey from 'next-auth/providers/passkey';
import { prisma } from '@sfam/db';
import type { Adapter, AdapterUser, AdapterAuthenticator } from 'next-auth/adapters';

/**
 * Custom Prisma Adapter that maps our schema to Auth.js expectations
 * Our schema uses different field names than the default Auth.js schema
 */
function createCustomAdapter(): Adapter {
  const baseAdapter = PrismaAdapter(prisma);
  
  return {
    ...baseAdapter,
    
    // Override user methods to handle our schema
    async createUser(data: Omit<AdapterUser, 'id'>) {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name ?? data.email.split('@')[0] ?? data.email,
        },
      });
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.avatarUrl,
      };
    },
    
    async getUser(id: string) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.avatarUrl,
      };
    },
    
    async getUserByEmail(email: string) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.avatarUrl,
      };
    },
    
    async updateUser(data: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      const user = await prisma.user.update({
        where: { id: data.id },
        data: {
          email: data.email ?? undefined,
          emailVerified: data.emailVerified,
          name: data.name ?? undefined,
          avatarUrl: data.image,
        },
      });
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.avatarUrl,
      };
    },
    
    // Session methods
    async createSession(data: { sessionToken: string; userId: string; expires: Date }) {
      const session = await prisma.session.create({
        data: {
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires,
        },
      });
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },
    
    async getSessionAndUser(sessionToken: string) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!session) return null;
      return {
        session: {
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
          name: session.user.name,
          image: session.user.avatarUrl,
        },
      };
    },
    
    async updateSession(data: { sessionToken: string; expires?: Date }) {
      const session = await prisma.session.update({
        where: { sessionToken: data.sessionToken },
        data: { expires: data.expires },
      });
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },
    
    async deleteSession(sessionToken: string) {
      await prisma.session.delete({ where: { sessionToken } }).catch(() => {
        // Session might already be deleted
      });
    },
    
    // WebAuthn Authenticator methods
    async createAuthenticator(data: AdapterAuthenticator): Promise<AdapterAuthenticator> {
      const authenticator = await prisma.authenticator.create({
        data: {
          credentialID: data.credentialID,
          userId: data.userId,
          credentialPublicKey: data.credentialPublicKey,
          counter: data.counter,
          credentialDeviceType: data.credentialDeviceType,
          credentialBackedUp: data.credentialBackedUp,
          transports: data.transports ?? null,
        },
      });
      return {
        credentialID: authenticator.credentialID,
        userId: authenticator.userId,
        credentialPublicKey: authenticator.credentialPublicKey,
        counter: Number(authenticator.counter),
        credentialDeviceType: authenticator.credentialDeviceType,
        credentialBackedUp: authenticator.credentialBackedUp,
        transports: authenticator.transports,
        providerAccountId: authenticator.credentialID,
      };
    },
    
    async getAuthenticator(credentialID: string): Promise<AdapterAuthenticator | null> {
      const authenticator = await prisma.authenticator.findUnique({
        where: { credentialID },
      });
      if (!authenticator) return null;
      return {
        credentialID: authenticator.credentialID,
        userId: authenticator.userId,
        credentialPublicKey: authenticator.credentialPublicKey,
        counter: Number(authenticator.counter),
        credentialDeviceType: authenticator.credentialDeviceType,
        credentialBackedUp: authenticator.credentialBackedUp,
        transports: authenticator.transports,
        providerAccountId: authenticator.credentialID,
      };
    },
    
    async listAuthenticatorsByUserId(userId: string): Promise<AdapterAuthenticator[]> {
      const authenticators = await prisma.authenticator.findMany({
        where: { userId },
      });
      return authenticators.map((auth) => ({
        credentialID: auth.credentialID,
        userId: auth.userId,
        credentialPublicKey: auth.credentialPublicKey,
        counter: Number(auth.counter),
        credentialDeviceType: auth.credentialDeviceType,
        credentialBackedUp: auth.credentialBackedUp,
        transports: auth.transports,
        providerAccountId: auth.credentialID,
      }));
    },
    
    async updateAuthenticatorCounter(credentialID: string, counter: number): Promise<AdapterAuthenticator> {
      const authenticator = await prisma.authenticator.update({
        where: { credentialID },
        data: { counter: BigInt(counter) },
      });
      return {
        credentialID: authenticator.credentialID,
        userId: authenticator.userId,
        credentialPublicKey: authenticator.credentialPublicKey,
        counter: Number(authenticator.counter),
        credentialDeviceType: authenticator.credentialDeviceType,
        credentialBackedUp: authenticator.credentialBackedUp,
        transports: authenticator.transports,
        providerAccountId: authenticator.credentialID,
      };
    },
  };
}

/**
 * Auth.js configuration with WebAuthn/Passkey support
 */
const authConfig = NextAuth({
  adapter: createCustomAdapter(),
  
  providers: [
    Passkey({
      // Relying Party configuration
      // These are set via environment variables
    }),
  ],
  
  session: {
    // Use database sessions for better security
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  
  experimental: {
    enableWebAuthn: true,
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      session.user.id = user.id;
      return session;
    },
  },
  
  // Trust the host header in development
  trustHost: true,
});

// Export auth functions with explicit types for tsgo compatibility
export const handlers: NextAuthResult['handlers'] = authConfig.handlers;
export const auth: NextAuthResult['auth'] = authConfig.auth;

// Export auth type for use in other files
export type { Session } from 'next-auth';
