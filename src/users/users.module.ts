import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminModeratorsController } from './admin-moderators.controller';
import { AdminUsersController } from './admin-users.controller';
import { PermissionsController, RolesController } from './roles.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule],
  controllers: [
    AdminUsersController,
    AdminModeratorsController,
    RolesController,
    PermissionsController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
