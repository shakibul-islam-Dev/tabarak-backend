import 'reflect-metadata';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Reflector } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validationExceptionFactory } from './common/pipes/validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const auth = app.get(AuthService);

  const port = config.get<number>('app.port') ?? 4000;
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api/v1';
  const uploadDir = join(process.cwd(), config.get<string>('app.uploadDir') ?? 'uploads');
  const trustedOrigins = config.get<string[]>('app.trustedOrigins') ?? [];
  const isProduction = config.get<boolean>('app.isProduction') ?? false;

  mkdirSync(uploadDir, { recursive: true });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || trustedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id'],
    exposedHeaders: ['Set-Cookie'],
  });

  // Better Auth must be mounted before the body parsers so it can read the
  // raw request body for its own endpoints.
  app.use('/api/auth', toNodeHandler(auth.instance));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  app.set('trust proxy', isProduction ? 1 : 0);
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
