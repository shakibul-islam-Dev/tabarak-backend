import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT = 4000;

  @IsString()
  API_PREFIX = 'api/v1';

  @IsString()
  FRONTEND_URL = 'http://localhost:3000';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'BETTER_AUTH_SECRET must be at least 32 characters long' })
  BETTER_AUTH_SECRET!: string;

  @IsString()
  BETTER_AUTH_URL = 'http://localhost:4000';

  @IsOptional()
  @IsString()
  TRUSTED_ORIGINS?: string;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_SECURE?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM?: string;

  @IsString()
  UPLOAD_DIR = 'uploads';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_FILE_SIZE = 5242880;
}

/**
 * Validates the process environment at boot. Fails fast with a readable
 * message instead of letting the application start in a broken state.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    ...config,
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: config.PORT ?? '4000',
    API_PREFIX: config.API_PREFIX ?? 'api/v1',
    FRONTEND_URL: config.FRONTEND_URL ?? 'http://localhost:3000',
    BETTER_AUTH_URL: config.BETTER_AUTH_URL ?? 'http://localhost:4000',
    UPLOAD_DIR: config.UPLOAD_DIR ?? 'uploads',
    MAX_FILE_SIZE: config.MAX_FILE_SIZE ?? '5242880',
  };

  // Empty optional numeric values should be treated as unset.
  if (!normalized.SMTP_PORT) {
    delete normalized.SMTP_PORT;
  }

  const instance = plainToInstance(EnvironmentVariables, normalized, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(instance, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return normalized;
}
