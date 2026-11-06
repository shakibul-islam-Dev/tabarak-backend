import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthSession, AuthUser } from '../../auth/auth.types';

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  session: AuthSession;
}

/**
 * Injects the authenticated Better Auth user. Optionally returns a single key.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return data ? request.user?.[data] : request.user;
  },
);
