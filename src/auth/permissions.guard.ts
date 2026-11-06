import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ADMIN_ONLY_KEY,
  PERMISSIONS_KEY,
} from '../common/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (!adminOnly && requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!admin || !admin.isActive) {
      throw new ForbiddenException('Administrator access required');
    }

    if (requiredPermissions.length > 0 && admin.role.slug !== 'super-admin') {
      const granted = new Set(admin.role.permissions.map((item) => item.permission.key));
      const missing = requiredPermissions.filter((permission) => !granted.has(permission));

      if (missing.length > 0) {
        throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
      }
    }

    return true;
  }
}
