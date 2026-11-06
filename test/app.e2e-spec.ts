import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { validationExceptionFactory } from '../src/common/pipes/validation';

describe('Tabark API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
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

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a healthy database connection', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ok', database: 'up' },
    });
  });

  it('lists published products with pagination metadata', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/products?limit=2').expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 2 });
  });

  it('exposes public storefront settings', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/settings').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Object);
  });

  it('rejects unauthenticated access to admin endpoints', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/dashboard').expect(401);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 401,
    });
  });

  it('requires a guest identifier for guest carts', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/cart').expect(400);

    expect(response.body.success).toBe(false);
  });
});
