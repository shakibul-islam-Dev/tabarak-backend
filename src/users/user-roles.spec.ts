import { ACCOUNT_ROLES, classifyUserRole, isAdminRole, isModeratorRole } from './user-roles';

describe('user role helpers', () => {
  it('classifies users without a staff profile as customers', () => {
    expect(classifyUserRole(null)).toBe('CUSTOMER');
    expect(classifyUserRole(undefined)).toBe('CUSTOMER');
  });

  it('recognises administrator roles', () => {
    expect(isAdminRole('super-admin')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(classifyUserRole('admin')).toBe('ADMIN');
  });

  it('recognises moderator roles', () => {
    expect(isModeratorRole('product-manager')).toBe(true);
    expect(classifyUserRole('product-manager')).toBe('MODERATOR');
  });

  it('treats unknown staff roles as moderators, never as admins', () => {
    expect(isAdminRole('catalog-reviewer')).toBe(false);
    expect(classifyUserRole('catalog-reviewer')).toBe('MODERATOR');
  });

  it('exposes the three public role categories', () => {
    expect(ACCOUNT_ROLES).toEqual(['ADMIN', 'MODERATOR', 'CUSTOMER']);
  });
});
