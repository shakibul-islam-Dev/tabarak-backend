/**
 * Canonical permission keys used by the admin RBAC layer. Keep this list in
 * sync with the permission seed data.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_MANAGE: 'products:manage',
  CATEGORIES_MANAGE: 'categories:manage',
  COLLECTIONS_MANAGE: 'collections:manage',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_MANAGE: 'inventory:manage',
  ORDERS_READ: 'orders:read',
  ORDERS_MANAGE: 'orders:manage',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_MANAGE: 'customers:manage',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  COUPONS_MANAGE: 'coupons:manage',
  SHIPPING_MANAGE: 'shipping:manage',
  CONTENT_MANAGE: 'content:manage',
  SETTINGS_MANAGE: 'settings:manage',
  UPLOADS_MANAGE: 'uploads:manage',
  AUDIT_READ: 'audit:read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
