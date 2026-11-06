import { Allow, IsObject, Matches } from 'class-validator';

export const SETTING_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;

export class UpdateSettingDto {
  /**
   * Settings are intentionally free-form JSON. The service validates the key
   * and the value is stored as-is in the `SiteSetting.value` JSON column.
   */
  @Allow()
  value!: unknown;
}

export class UpdateSettingsDto {
  @IsObject()
  settings!: Record<string, unknown>;
}

export class SettingKeyParamDto {
  @Matches(SETTING_KEY_PATTERN, {
    message: 'key may only contain letters, numbers, dots, underscores and dashes',
  })
  key!: string;
}
