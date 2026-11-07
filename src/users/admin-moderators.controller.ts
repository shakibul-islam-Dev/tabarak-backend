import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AdminUserQueryDto, CreateModeratorDto, UpdateModeratorDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('admin/moderators')
export class AdminModeratorsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findAll(@Query() query: AdminUserQueryDto) {
    return this.usersService.findModerators(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ResponseMessage('Moderator created successfully')
  create(@Body() dto: CreateModeratorDto, @CurrentUser('id') actorUserId: string) {
    return this.usersService.createModerator(actorUserId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ResponseMessage('Moderator updated successfully')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModeratorDto,
    @CurrentUser('id') actorUserId: string,
  ) {
    return this.usersService.updateModerator(actorUserId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ResponseMessage('Moderator deactivated successfully')
  deactivate(@Param('id') id: string, @CurrentUser('id') actorUserId: string) {
    return this.usersService.deactivateModerator(actorUserId, id);
  }
}
