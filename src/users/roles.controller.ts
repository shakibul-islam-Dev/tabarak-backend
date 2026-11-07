import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { UsersService } from './users.service';

@Controller('admin/roles')
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list() {
    return this.usersService.listRoles();
  }
}

@Controller('admin/permissions')
export class PermissionsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list() {
    return this.usersService.listPermissions();
  }
}
