/**
 * Canonical role groups used by user administration.
 *
 * Better Auth remains the source of truth for identities, while the
 * `AdminProfile` + `Role` relation models staff membership. Customers are
 * users with no active staff profile. These helpers translate that data model
 * into the three public role categories: ADMIN, MODERATOR and CUSTOMER.
 */
export const ADMIN_ROLE_SLUGS = ['super-admin', 'admin'] as const;

export const MODERATOR_ROLE_SLUGS = [
  'product-manager',
  'order-manager',
  'customer-support',
] as const;

export type AccountRole = 'ADMIN' | 'MODERATOR' | 'CUSTOMER';

export const ACCOUNT_ROLES: AccountRole[] = ['ADMIN', 'MODERATOR', 'CUSTOMER'];

export function isAdminRole(slug: string | null | undefined): boolean {
  return !!slug && (ADMIN_ROLE_SLUGS as readonly string[]).includes(slug);
}

export function isModeratorRole(slug: string | null | undefined): boolean {
  return !!slug && (MODERATOR_ROLE_SLUGS as readonly string[]).includes(slug);
}

/**
 * Any staff profile that is not an administrator is treated as a moderator,
 * including custom roles created by an administrator. Unknown role slugs can
 * never be promoted to ADMIN by name, so the classification stays safe.
 */
export function classifyUserRole(adminRoleSlug: string | null | undefined): AccountRole {
  if (!adminRoleSlug) {
    return 'CUSTOMER';
  }

  return isAdminRole(adminRoleSlug) ? 'ADMIN' : 'MODERATOR';
}
