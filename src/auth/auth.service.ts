import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { IncomingHttpHeaders } from 'node:http';
import { PrismaService } from '../database/prisma.service';
import { AUTH_INSTANCE, type AuthInstance } from './auth.factory';
import { SessionContext } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_INSTANCE) readonly instance: AuthInstance,
    private readonly prisma: PrismaService,
  ) {}

  get api(): AuthInstance['api'] {
    return this.instance.api;
  }

  async getSession(headers: Headers): Promise<SessionContext | null> {
    const result = await this.instance.api.getSession({ headers });
    if (!result) {
      return null;
    }

    return {
      user: result.user,
      session: result.session,
    };
  }

  getSessionFromHeaders(headers: IncomingHttpHeaders): Promise<SessionContext | null> {
    return this.getSession(fromNodeHeaders(headers));
  }

  async getCustomerProfile(userId: string) {
    return this.prisma.customerProfile.findUnique({ where: { userId } });
  }

  /**
   * Returns the customer profile, creating it if the signup hook did not run
   * (for example, for users migrated from another system).
   */
  async ensureCustomerProfile(userId: string) {
    const existing = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }

    return this.prisma.customerProfile.create({
      data: { userId, wishlist: { create: {} } },
    });
  }
}
