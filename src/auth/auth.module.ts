import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { AUTH_INSTANCE, createAuth } from './auth.factory';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [PrismaService, ConfigService, EmailService],
      useFactory: (prisma: PrismaService, config: ConfigService, email: EmailService) =>
        createAuth(prisma, config, email),
    },
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [AuthService, AUTH_INSTANCE],
})
export class AuthModule {}
