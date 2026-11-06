import { applyDecorators, SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const ADMIN_ONLY_KEY = 'adminOnly';

/**
 * Requires the authenticated user to be an active administrator holding every
 * listed permission (super admins bypass individual permission checks).
 */
export const RequirePermissions = (...permissions: string[]) =>
  applyDecorators(SetMetadata(PERMISSIONS_KEY, permissions), SetMetadata(ADMIN_ONLY_KEY, true));

/**
 * Requires the authenticated user to be an active administrator.
 */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
