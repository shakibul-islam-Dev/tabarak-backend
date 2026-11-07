import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AdminUserQueryDto, AssignRoleDto, UpdateUserStatusDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findAll(@Query() query: AdminUserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/role')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ResponseMessage('User role updated successfully')
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser('id') actorUserId: string,
  ) {
    return this.usersService.assignRole(actorUserId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ResponseMessage('User status updated successfully')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') actorUserId: string,
  ) {
    return this.usersService.updateStatus(actorUserId, id, dto);
  }
}
