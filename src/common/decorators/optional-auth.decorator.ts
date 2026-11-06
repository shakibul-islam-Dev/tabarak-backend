import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/**
 * Allows the request to proceed without a session while still attaching the
 * authenticated user when one is present. Used by guest-capable cart endpoints.
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
