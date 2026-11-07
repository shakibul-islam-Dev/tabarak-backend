import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AddressesModule } from './addresses/addresses.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CollectionsModule } from './collections/collections.module';
import { CouponsModule } from './coupons/coupons.module';
import { CustomersModule } from './customers/customers.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { EmailModule } from './email/email.module';
import { InventoryModule } from './inventory/inventory.module';
import { ModeratorModule } from './moderator/moderator.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { ShippingModule } from './shipping/shipping.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    EmailModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    CollectionsModule,
    InventoryModule,
    CartModule,
    WishlistModule,
    CustomersModule,
    AddressesModule,
    ShippingModule,
    CouponsModule,
    OrdersModule,
    CheckoutModule,
    UploadsModule,
    NewsletterModule,
    AuditModule,
    UsersModule,
    ModeratorModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
