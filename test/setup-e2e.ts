/**
 * Better Auth ships ESM-only entry points that Jest cannot load without a
 * full ESM toolchain. The e2e suite focuses on the Nest API surface, so the
 * auth runtime is stubbed while the real AuthGuard/PermissionsGuard logic
 * remains under test.
 */
jest.mock('better-auth', () => ({
  betterAuth: jest.fn(() => ({
    api: { getSession: jest.fn().mockResolvedValue(null) },
    handler: jest.fn(),
  })),
}));

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn(() => new Headers()),
}));

jest.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: jest.fn(() => ({})),
}));
