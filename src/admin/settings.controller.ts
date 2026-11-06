import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { SettingKeyParamDto, UpdateSettingDto, UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Public()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }
}

@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  list() {
    return this.settingsService.listAll();
  }

  @Get(':key')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  get(@Param() params: SettingKeyParamDto) {
    return this.settingsService.get(params.key);
  }

  @Put()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Settings updated successfully')
  updateMany(@Body() dto: UpdateSettingsDto, @CurrentUser('id') actorUserId: string) {
    return this.settingsService.upsertMany(dto.settings, actorUserId);
  }

  @Put(':key')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Setting updated successfully')
  update(
    @Param() params: SettingKeyParamDto,
    @Body() dto: UpdateSettingDto,
    @CurrentUser('id') actorUserId: string,
  ) {
    return this.settingsService.upsert(params.key, dto.value, actorUserId);
  }

  @Delete(':key')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Setting deleted successfully')
  remove(@Param() params: SettingKeyParamDto, @CurrentUser('id') actorUserId: string) {
    return this.settingsService.remove(params.key, actorUserId);
  }
}
