import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CustomerStatus } from '@prisma/client';
import { IncomingHttpHeaders } from 'node:http';
import { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { OPTIONAL_AUTH_KEY } from '../common/decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const optionalAuth = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { headers: IncomingHttpHeaders }>();

    const sessionContext = await this.authService
      .getSessionFromHeaders(request.headers)
      .catch(() => null);

    if (!sessionContext) {
      if (optionalAuth) {
        return true;
      }
      throw new UnauthorizedException('Authentication required');
    }

    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: sessionContext.user.id },
      select: { status: true },
    });

    if (profile?.status === CustomerStatus.DISABLED) {
      throw new ForbiddenException('Your account has been disabled');
    }

    request.user = sessionContext.user;
    request.session = sessionContext.session;

    return true;
  }
}
