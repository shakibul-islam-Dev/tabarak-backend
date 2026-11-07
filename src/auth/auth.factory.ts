import { ConfigService } from '@nestjs/config';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { betterAuth } from 'better-auth';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';

export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

export type AuthInstance = ReturnType<typeof createAuth>;

/**
 * Builds the single Better Auth instance used by the application. Better Auth
 * remains the source of truth for users, credentials and sessions.
 */
export function createAuth(prisma: PrismaService, config: ConfigService, email: EmailService) {
  const isProduction = config.get<boolean>('app.isProduction') ?? false;
  const trustedOrigins = config.get<string[]>('app.trustedOrigins') ?? [];
  const mailEnabled = config.get<boolean>('mail.enabled') ?? false;
  const cookieSameSite = config.get<'lax' | 'strict' | 'none'>('auth.cookieSameSite') ?? 'lax';

  return betterAuth({
    appName: 'tabarak',
    baseURL: config.get<string>('auth.baseUrl'),
    basePath: '/api/auth',
    secret: config.get<string>('auth.secret'),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: mailEnabled,
      autoSignIn: !mailEnabled,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await email.sendPasswordResetEmail(user.email, user.name, url);
      },
    },
    emailVerification: {
      sendOnSignUp: mailEnabled,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await email.sendVerificationEmail(user.email, user.name, url);
      },
      afterEmailVerification: async (user) => {
        void email.sendWelcomeEmail(user.email, user.name);
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isProduction,
        sameSite: cookieSameSite,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              await prisma.customerProfile.create({
                data: {
                  userId: user.id,
                  wishlist: { create: {} },
                },
              });
            } catch (error) {
              // Profile creation is retried lazily when the customer accesses
              // profile-bound endpoints, so a failure must not block signup.
              console.error('Failed to provision customer profile', error);
            }
          },
        },
      },
    },
  });
}
